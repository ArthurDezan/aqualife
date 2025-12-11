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
  graficoVisivel: string | null = null; 

  // --- Variáveis de Dados ---
  ph: number = 0;
  turbidez: number = 0;
  
  nivelAguaValor: number = 0; 
  nivelAguaTexto: string = 'Carregando...';

  // Históricos
  histPH: number[] = [];
  histTurbidez: number[] = [];
  labelsTempo: string[] = [];

  private updateInterval: any;
  
  @ViewChild('chartPH') chartPHCanvas: ElementRef | undefined;
  @ViewChild('chartTurbidez') chartTurbidezCanvas: ElementRef | undefined;
  @ViewChild('chartBarHorizontal') chartBarHorizontalCanvas: ElementRef | undefined;

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
    this.updateInterval = setInterval(() => {
      this.buscarDadosApi();
    }, 7000);
  }

  private converterParaTimestamp(item: any): number {
    let valorData = item.timestamp;
    if (!valorData || typeof valorData !== "string") {
      if (item._id) {
        try {
          return parseInt(item._id.substring(0, 8), 16) * 1000;
        } catch (e) { return 0; }
      }
      return 0;
    }
    const regex = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/;
    const partes = valorData.match(regex);
    if (!partes) return 0;
    
    return new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]), Number(partes[4]), Number(partes[5]), Number(partes[6])).getTime();
  }

  buscarDadosApi() {
    this.apiService.getDadosSensores().subscribe({
      next: (dados: any) => {
        if (Array.isArray(dados) && dados.length > 0) {
          
          dados.sort((a: any, b: any) =>
            this.converterParaTimestamp(a) - this.converterParaTimestamp(b)
          );

          const leituraAtual = dados[dados.length - 1];

          this.ph = Number(leituraAtual.PH);
          this.turbidez = Number(leituraAtual.turbidez || 0);
          
          this.nivelAguaValor = Number(leituraAtual['nível da água'] || 0);
          this.nivelAguaTexto = (this.nivelAguaValor === 1) ? 'Nível Ok' : 'Nível Baixo';

          // --- PREPARAÇÃO DOS DADOS DO GRÁFICO ---
          const ultimos10 = dados.slice(-10);
          this.histPH = ultimos10.map((d: any) => Number(d.PH));
          this.histTurbidez = ultimos10.map((d: any) => Number(d.turbidez || 0));
          
          // --- FORMATAÇÃO CRÍTICA DAS ETIQUETAS ---
          this.labelsTempo = ultimos10.map((d: any) => {
            if (!d.timestamp) return '';
            // Tenta extrair apenas a hora HH:mm para poupar espaço
            // Exemplo entrada: "11/12/2024, 07:11:53" -> Saída: "07:11"
            const regex = /(\d{2}):(\d{2})/;
            const match = d.timestamp.match(regex);
            if (match) {
               return match[0]; // Retorna "07:11"
            }
            // Fallback: se não conseguir regex, retorna string vazia ou algo curto
            return ''; 
          });

          this.atualizarOuCriarGraficoHorizontal();

        }
        
        this.isLoading = false;
        
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
    return this.nivelAguaTexto === 'Nível Ok' ? 'bom' : 'perigo';
  }

  atualizarOuCriarGraficoHorizontal() {
    if (this.horizontalChartInstance) {
      this.horizontalChartInstance.data.datasets[0].data = [this.ph, this.turbidez];
      this.horizontalChartInstance.update();
    } else {
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
          backgroundColor: ['rgba(75, 192, 192, 0.7)', 'rgba(255, 159, 64, 0.7)'],
          borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 159, 64, 1)'],
          borderWidth: 1,
          barPercentage: 0.6,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            max: 14
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  toggleGrafico(metrica: string) {
    const metricaSendoAberta = metrica;
    const metricaAbertaAtualmente = this.graficoVisivel;

    if (metricaAbertaAtualmente === metricaSendoAberta) {
      this.graficoVisivel = null;
      setTimeout(() => {
        if (this.chartInstances[metricaSendoAberta]) {
          this.chartInstances[metricaSendoAberta].destroy();
          delete this.chartInstances[metricaSendoAberta];
        }
      }, 500);
      return;
    }

    if (metricaAbertaAtualmente && this.chartInstances[metricaAbertaAtualmente]) {
      this.chartInstances[metricaAbertaAtualmente].destroy();
      delete this.chartInstances[metricaAbertaAtualmente];
    }

    this.graficoVisivel = metricaSendoAberta;
    // Timeout para garantir que o container expandiu
    setTimeout(() => {
      this.criarGraficoLinha(metricaSendoAberta);
    }, 100); 
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

  // --- AQUI ESTÁ A CORREÇÃO PRINCIPAL ---
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

    if (!canvas) {
      console.warn('Canvas não encontrado para:', metrica);
      return;
    }

    const ctx = canvas.nativeElement.getContext('2d');
    
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.labelsTempo, // Etiquetas já formatadas (ex: "10:05")
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
        scales: { 
          y: { 
            beginAtZero: false 
          },
          // --- CORREÇÃO DO EIXO X ---
          x: {
            ticks: {
              maxTicksLimit: 4, // Força no máximo 4 etiquetas
              maxRotation: 0,   // Impede texto inclinado
              autoSkip: true    // Pula etiquetas automaticamente
            }
          }
        }
      }
    });
    this.chartInstances[metrica] = chart;
  }
}