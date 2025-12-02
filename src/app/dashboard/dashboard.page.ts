import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage implements OnInit, OnDestroy {

  isLoading: boolean = true;
  graficoVisivel: string | null = null;

  // Variáveis atuais (Temperatura removida)
  ph: number = 0;
  turbidez: number = 0;

  // Histórico para os gráficos (Temperatura removida)
  histPH: number[] = [];
  histTurbidez: number[] = [];
  labelsTempo: string[] = [];

  private updateInterval: any;

  // Referência ao canvas de Temperatura removida
  @ViewChild('chartPH') chartPHCanvas: ElementRef | undefined;
  @ViewChild('chartTurbidez') chartTurbidezCanvas: ElementRef | undefined;
  
  private chartInstances: { [key: string]: Chart } = {};

  constructor(private apiService: ApiService) { }

  ngOnInit() {
    this.carregarDadosIniciais();
  }

  ngOnDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  carregarDadosIniciais() {
    this.isLoading = true;
    this.buscarDadosApi();
    this.updateInterval = setInterval(() => {
      this.buscarDadosApi();
    }, 7000);
  }

  buscarDadosApi() {
    this.apiService.getDadosSensores().subscribe({
      next: (dados: any) => {
        
        if (Array.isArray(dados) && dados.length > 0) {
          
          const leituraAtual = dados[dados.length - 1];
          console.log('🔍 Leitura Processada:', leituraAtual);

          // Atualiza valores atuais
          this.ph = Number(leituraAtual.PH); 
          this.turbidez = Number(leituraAtual.umidade || 0);

          // Atualiza Histórico
          const ultimos10 = dados.slice(-10);
          
          this.histPH = ultimos10.map((d: any) => Number(d.PH));
          this.histTurbidez = ultimos10.map((d: any) => Number(d.umidade || 0));
          
          // Eixo X (Horários)
          const agora = new Date();
          const horaString = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          
          // Verifica se precisa preencher labels com base no tamanho do histórico de PH
          if (this.labelsTempo.length !== this.histPH.length) {
             this.labelsTempo = new Array(this.histPH.length).fill(horaString);
          }

        } else {
          console.warn('⚠️ Lista vazia ou formato inválido:', dados);
        }

        this.isLoading = false;

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

  // Função auxiliar caso precises adicionar manualmente (opcional)
  atualizarHistorico(ph: number, turb: number) {
    const agora = new Date();
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    this.histPH.push(ph);
    this.histTurbidez.push(turb);
    this.labelsTempo.push(horaFormatada);

    if (this.histPH.length > 10) {
      this.histPH.shift();
      this.histTurbidez.shift();
      this.labelsTempo.shift();
    }
  }

  atualizarGraficoAberto() {
    const metrica = this.graficoVisivel;
    if (!metrica || !this.chartInstances[metrica]) return;

    const chart = this.chartInstances[metrica];
    chart.data.labels = this.labelsTempo;

    switch (metrica) {
      case 'pH':
        chart.data.datasets[0].data = this.histPH;
        break;
      case 'Turbidez':
        chart.data.datasets[0].data = this.histTurbidez;
        break;
    }
    
    chart.update();
  }

  // --- Funções de Status ---
  // getStatusTemperatura REMOVIDO

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
      // Case 'Temperatura' REMOVIDO
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