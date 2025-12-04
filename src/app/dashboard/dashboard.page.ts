import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { ApiService } from '../services/api.service';
import { LocalNotifications } from '@capacitor/local-notifications';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage implements OnInit, OnDestroy {

  isLoading: boolean = true;
  graficoVisivel: string | null = null; // Controla os gráficos de linha individuais (popup)

  // --- Variáveis de Dados ---
  ph: number = 0;
  turbidez: number = 0;
  
  // Variáveis para o Nível da Água
  nivelAguaValor: number = 0; 
  nivelAguaTexto: string = 'Carregando...'; // Texto que aparecerá no card

  // Históricos para gráficos de linha (detalhe)
  histPH: number[] = [];
  histTurbidez: number[] = [];
  labelsTempo: string[] = [];

  private updateInterval: any;
  
  // Variáveis para controlar o "Anti-Spam" das notificações
  private ultimoAlerta: number = 0;
  private readonly INTERVALO_ALERTA = 1000 * 60 * 10; // 10 minutos

  // --- Referências aos elementos do HTML (Canvas) ---
  @ViewChild('chartPH') chartPHCanvas: ElementRef | undefined;
  @ViewChild('chartTurbidez') chartTurbidezCanvas: ElementRef | undefined;
  @ViewChild('chartBarHorizontal') chartBarHorizontalCanvas: ElementRef | undefined; // Gráfico Principal

  private chartInstances: { [key: string]: Chart } = {};
  private horizontalChartInstance: Chart | undefined;

  constructor(private apiService: ApiService) { }

  async ngOnInit() {
    await this.solicitarPermissaoNotificacao();
    this.carregarDadosIniciais();
  }

  ngOnDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  async solicitarPermissaoNotificacao() {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  }

  carregarDadosIniciais() {
    this.isLoading = true;
    this.buscarDadosApi();
    // Atualiza os dados a cada 7 segundos
    this.updateInterval = setInterval(() => {
      this.buscarDadosApi();
    }, 7000);
  }

  // Função para garantir que a data vem correta
  private converterParaTimestamp(item: any): number {
    let valorData = item.timestamp;
    if (!valorData || typeof valorData !== "string") {
      // Fallback: tenta recuperar data pelo ID do MongoDB se não houver timestamp
      if (item._id) {
        try {
          return parseInt(item._id.substring(0, 8), 16) * 1000;
        } catch (e) { return 0; }
      }
      return 0;
    }
    // Formato esperado: "DD/MM/YYYY, HH:mm:ss"
    const regex = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/;
    const partes = valorData.match(regex);
    if (!partes) return 0;
    
    // Cria data em JS (Mês começa em 0)
    return new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]), Number(partes[4]), Number(partes[5]), Number(partes[6])).getTime();
  }

  buscarDadosApi() {
    this.apiService.getDadosSensores().subscribe({
      next: (dados: any) => {
        if (Array.isArray(dados) && dados.length > 0) {
          
          // 1. Ordenação cronológica (do mais antigo para o mais recente)
          dados.sort((a: any, b: any) =>
            this.converterParaTimestamp(a) - this.converterParaTimestamp(b)
          );

          // 2. Pegar a leitura mais recente (última da lista)
          const leituraAtual = dados[dados.length - 1];
          console.log('✅ Leitura Mais Recente:', leituraAtual);

          // --- ATUALIZAÇÃO DOS VALORES ---
          this.ph = Number(leituraAtual.PH);
          this.turbidez = Number(leituraAtual.turbidez || 0);
          
          // --- LÓGICA DO NÍVEL DA ÁGUA (0 ou 1) ---
          // AQUI ESTÁ A CORREÇÃO: Usamos ['nível da água'] por causa dos espaços e acentos
          this.nivelAguaValor = Number(leituraAtual['nível da água'] || 0);
          
          // Se for 1 -> Nível Ok. Se for 0 -> Nível Baixo.
          if (this.nivelAguaValor === 1) {
            this.nivelAguaTexto = 'Nível Ok';
          } else {
            this.nivelAguaTexto = 'Nível Baixo';
          }

          // --- HISTÓRICO PARA OS GRÁFICOS DE LINHA (Últimos 10) ---
          const ultimos10 = dados.slice(-10);
          this.histPH = ultimos10.map((d: any) => Number(d.PH));
          this.histTurbidez = ultimos10.map((d: any) => Number(d.turbidez || 0));
          
          // Formata a hora para o eixo X
          this.labelsTempo = ultimos10.map((d: any) => {
            const regex = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/;
            const partes = d.timestamp.match(regex);
            if (partes) return `${partes[1]}/${partes[2]} ${partes[4]}:${partes[5]}`;
            return '';
          });

          // Atualiza o gráfico horizontal principal
          this.atualizarOuCriarGraficoHorizontal();

        } else {
          console.warn('⚠️ Lista vazia:', dados);
        }
        
        this.isLoading = false;
        
        // Se algum card estiver aberto (gráfico de linha), atualiza-o também
        if (this.graficoVisivel) {
          this.atualizarGraficoLinhaAberto();
        }
      },
      error: (erro) => {
        console.error('❌ Erro API:', erro);
        this.isLoading = false;
      }
    });
  }

  // --- Helpers de Status (Cores) ---

  getStatusPH() {
    if (this.ph < 6.5 || this.ph > 8.0) return 'perigo';
    if (this.ph < 7.0 || this.ph > 7.6) return 'atencao';
    return 'bom';
  }
  
  getStatusTurbidez() {
    if (this.turbidez > 5.0) return 'perigo';
    if (this.turbidez > 3.0) return 'atencao';
    return 'bom';
  }

  getStatusNivelSimples() {
    // Retorna a classe CSS baseada no texto
    return this.nivelAguaTexto === 'Nível Ok' ? 'bom' : 'perigo';
  }

  // --- NOVO GRÁFICO DE BARRAS HORIZONTAL (Resumo Geral) ---

  atualizarOuCriarGraficoHorizontal() {
    if (this.horizontalChartInstance) {
      this.horizontalChartInstance.data.datasets[0].data = [this.ph, this.turbidez];
      this.horizontalChartInstance.update();
    } else {
      // Pequeno delay para garantir que o canvas existe no DOM
      setTimeout(() => this.criarGraficoHorizontal(), 100);
    }
  }

  criarGraficoHorizontal() {
    if (!this.chartBarHorizontalCanvas) return;

    const ctx = this.chartBarHorizontalCanvas.nativeElement.getContext('2d');

    this.horizontalChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['pH', 'Turbidez'],
        datasets: [{
          label: 'Valor Atual',
          data: [this.ph, this.turbidez],
          backgroundColor: [
            'rgba(75, 192, 192, 0.7)', // Cor pH (Verde Água)
            'rgba(255, 159, 64, 0.7)'  // Cor Turbidez (Laranja)
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 159, 64, 1)'
          ],
          borderWidth: 1,
          barPercentage: 0.6,
        }]
      },
      options: {
        indexAxis: 'y', // <--- Transforma em gráfico HORIZONTAL
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            max: 14, // Define o "Máximo Alcançável" visual (Escala de pH)
            title: {
              display: true,
              text: 'Escala de Medição (0 - 14)'
            }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // --- GRÁFICOS DE LINHA INDIVIDUAIS (Ao clicar nos cards pequenos) ---

  toggleGrafico(metrica: string) {
    const metricaSendoAberta = metrica;
    const metricaAbertaAtualmente = this.graficoVisivel;
    const tempoAnimacaoCSS = 500;

    // Se clicar no mesmo que já está aberto, fecha.
    if (metricaAbertaAtualmente === metricaSendoAberta) {
      this.graficoVisivel = null;
      setTimeout(() => {
        if (this.chartInstances[metricaSendoAberta]) {
          this.chartInstances[metricaSendoAberta].destroy();
          delete this.chartInstances[metricaSendoAberta];
        }
      }, tempoAnimacaoCSS);
      return;
    }

    // Se tiver outro aberto, destrói o anterior antes de abrir o novo
    if (metricaAbertaAtualmente && this.chartInstances[metricaAbertaAtualmente]) {
      this.chartInstances[metricaAbertaAtualmente].destroy();
      delete this.chartInstances[metricaAbertaAtualmente];
    }

    this.graficoVisivel = metricaSendoAberta;
    setTimeout(() => {
      this.criarGraficoLinha(metricaSendoAberta);
    }, 50);
  }

  atualizarGraficoLinhaAberto() {
    const metrica = this.graficoVisivel;
    if (!metrica || !this.chartInstances[metrica]) return;
    
    const chart = this.chartInstances[metrica];
    chart.data.labels = this.labelsTempo;
    
    if (metrica === 'pH') chart.data.datasets[0].data = this.histPH;
    if (metrica === 'Turbidez') chart.data.datasets[0].data = this.histTurbidez;
    
    chart.update();
  }

  criarGraficoLinha(metrica: string) {
    let canvas: ElementRef | undefined;
    let dadosParaUsar: number[] = [];
    let corBorda = '#00796b';
    let corFundo = 'rgba(0, 121, 107, 0.2)';

    if (metrica === 'pH') {
      canvas = this.chartPHCanvas;
      dadosParaUsar = this.histPH;
      corBorda = '#D32F2F'; corFundo = 'rgba(211, 47, 47, 0.2)';
    } else {
      canvas = this.chartTurbidezCanvas;
      dadosParaUsar = this.histTurbidez;
      corBorda = '#F57C00'; corFundo = 'rgba(245, 124, 0, 0.2)';
    }

    if (!canvas) return;

    const ctx = canvas.nativeElement.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.labelsTempo,
        datasets: [{
          label: metrica,
          data: dadosParaUsar,
          fill: true,
          backgroundColor: corFundo,
          borderColor: corBorda,
          borderWidth: 2,
          tension: 0.3
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: false } }
      }
    });
    this.chartInstances[metrica] = chart;
  }
}