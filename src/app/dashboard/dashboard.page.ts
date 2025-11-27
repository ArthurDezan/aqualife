import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { ApiService } from '../services/api.service'; // Importar o serviço

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage implements OnInit, OnDestroy {

  isLoading: boolean = true;
  graficoVisivel: string | null = null;

  // Variáveis com os valores atuais (exibidos nos cards)
  temperatura: number = 0;
  ph: number = 0;
  turbidez: number = 0;

  // Histórico para os gráficos (Armazena os últimos 10 valores)
  histTemperatura: number[] = [];
  histPH: number[] = [];
  histTurbidez: number[] = [];
  labelsTempo: string[] = []; // Horários das leituras

  // Controle do intervalo de atualização
  private updateInterval: any;

  @ViewChild('chartTemperatura') chartTemperaturaCanvas: ElementRef | undefined;
  @ViewChild('chartPH') chartPHCanvas: ElementRef | undefined;
  @ViewChild('chartTurbidez') chartTurbidezCanvas: ElementRef | undefined;
  
  private chartInstances: { [key: string]: Chart } = {};

  constructor(private apiService: ApiService) { }

  ngOnInit() {
    this.carregarDadosIniciais();
  }

  // Quando sair da página, paramos a atualização para economizar bateria
  ngOnDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  carregarDadosIniciais() {
    this.isLoading = true;
    
    // 1. Busca imediata
    this.buscarDadosApi();

    // 2. Agenda a atualização a cada 7 segundos
    this.updateInterval = setInterval(() => {
      this.buscarDadosApi();
    }, 7000);
  }

  buscarDadosApi() {
    this.apiService.getDadosSensores().subscribe({
      next: (dados: any) => {
        
        // 1. Verifica se recebemos uma lista com dados
        if (Array.isArray(dados) && dados.length > 0) {
          
          // 2. Pega o ÚLTIMO item da lista (o mais recente)
          const leituraAtual = dados[dados.length - 1];

          console.log('🔍 Leitura Processada:', leituraAtual);

          // 3. Atualiza os valores atuais
          this.temperatura = Number(leituraAtual.temperatura);
          this.ph = Number(leituraAtual.PH); // 'PH' maiúsculo conforme a API
          
          // AQUI ESTÁ A CORREÇÃO: Usamos 'umidade' no lugar de turbidez
          this.turbidez = Number(leituraAtual.umidade || 0);

          // 4. Atualiza o Histórico (últimos 10) para o gráfico
          const ultimos10 = dados.slice(-10);
          
          this.histTemperatura = ultimos10.map((d: any) => Number(d.temperatura));
          this.histPH = ultimos10.map((d: any) => Number(d.PH));
          this.histTurbidez = ultimos10.map((d: any) => Number(d.umidade || 0)); // Gráfico também usa umidade
          
          // 5. Gera horários para o eixo X do gráfico
          const agora = new Date();
          const horaString = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          
          // Garante que temos labels suficientes para os dados
          if (this.labelsTempo.length !== this.histTemperatura.length) {
             this.labelsTempo = new Array(this.histTemperatura.length).fill(horaString);
          }

        } else {
          console.warn('⚠️ A API retornou uma lista vazia ou formato inválido:', dados);
        }

        this.isLoading = false;

        // 6. Se algum gráfico estiver aberto, atualiza visualmente
        if (this.graficoVisivel) {
          this.atualizarGraficoAberto();
        }
      },
      error: (erro) => {
        console.error('❌ Erro na conexão com a API:', erro);
        this.isLoading = false;
      }
    });
  }

  atualizarHistorico(temp: number, ph: number, turb: number) {
    const agora = new Date();
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Adiciona novos dados
    this.histTemperatura.push(temp);
    this.histPH.push(ph);
    this.histTurbidez.push(turb);
    this.labelsTempo.push(horaFormatada);

    // Mantém apenas os últimos 10 registros para o gráfico não ficar gigante
    if (this.histTemperatura.length > 10) {
      this.histTemperatura.shift();
      this.histPH.shift();
      this.histTurbidez.shift();
      this.labelsTempo.shift();
    }
  }

  // Atualiza apenas o gráfico que está visível na tela sem recriá-lo
  atualizarGraficoAberto() {
    const metrica = this.graficoVisivel;
    if (!metrica || !this.chartInstances[metrica]) return;

    const chart = this.chartInstances[metrica];
    
    // Atualiza as labels (eixo X)
    chart.data.labels = this.labelsTempo;

    // Atualiza os dados (eixo Y)
    switch (metrica) {
      case 'Temperatura':
        chart.data.datasets[0].data = this.histTemperatura;
        break;
      case 'pH':
        chart.data.datasets[0].data = this.histPH;
        break;
      case 'Turbidez':
        chart.data.datasets[0].data = this.histTurbidez;
        break;
    }
    
    chart.update(); // Mágica do Chart.js para animar a mudança
  }

  // --- Funções de Status (Mantidas) ---
  getStatusTemperatura() {
    if (this.temperatura < 18 || this.temperatura > 28) { return 'perigo'; }
    if (this.temperatura < 21 || this.temperatura > 26) { return 'atencao'; }
    return 'bom';
  }
  getStatusPH() {
    if (this.ph < 6.5 || this.ph > 8.0) { return 'perigo'; }
    if (this.ph < 7.0 || this.ph > 7.6) { return 'atencao'; }
    return 'bom';
  }
  getStatusTurbidez() {
    if (this.turbidez > 5.0) { return 'perigo'; }
    if (this.turbidez > 3.0) { return 'atencao'; }
    return 'bom';
  }

  // --- Lógica de Toggle (Ajustada para usar o histórico real) ---
  toggleGrafico(metrica: string) {
    const metricaSendoAberta = metrica;
    const metricaAbertaAtualmente = this.graficoVisivel;
    const tempoAnimacaoCSS = 500;

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

    if (metricaAbertaAtualmente && this.chartInstances[metricaAbertaAtualmente]) {
      this.chartInstances[metricaAbertaAtualmente].destroy();
      delete this.chartInstances[metricaAbertaAtualmente];
    }

    this.graficoVisivel = metricaSendoAberta;
    
    // Pequeno delay para garantir que o DOM (HTML) atualizou e o Canvas está visível
    setTimeout(() => {
        this.criarGrafico(metricaSendoAberta);
    }, 50);
  }

  criarGrafico(metrica: string) {
    let canvas: ElementRef | undefined;
    let dadosParaUsar: number[] = [];
    let corBorda = '#00796b';
    let corFundo = 'rgba(0, 121, 107, 0.2)';

    switch (metrica) {
      case 'Temperatura':
        canvas = this.chartTemperaturaCanvas;
        dadosParaUsar = this.histTemperatura;
        corBorda = '#0288D1'; 
        corFundo = 'rgba(2, 136, 209, 0.2)';
        break;
      case 'pH':
        canvas = this.chartPHCanvas;
        dadosParaUsar = this.histPH;
        corBorda = '#D32F2F'; 
        corFundo = 'rgba(211, 47, 47, 0.2)';
        break;
      case 'Turbidez':
        canvas = this.chartTurbidezCanvas;
        dadosParaUsar = this.histTurbidez;
        corBorda = '#F57C00'; 
        corFundo = 'rgba(245, 124, 0, 0.2)';
        break;
    }

    if (!canvas) return;

    const ctx = canvas.nativeElement.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.labelsTempo, // Usa os horários reais
        datasets: [{
          label: metrica,
          data: dadosParaUsar, // Usa o histórico acumulado
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
        maintainAspectRatio: false, // Importante para caber na div expandida
        scales: { y: { beginAtZero: false } }
      }
    });

    this.chartInstances[metrica] = chart;
  }
}