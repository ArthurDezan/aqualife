import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage implements OnInit {

  // (Variáveis de estado e dados continuam iguais)
  isLoading: boolean = true; 
  graficoVisivel: string | null = null;
  temperatura: number = 23.5;
  ph: number = 8.1;
  turbidez: number = 4.2;

  // (Referências aos Canvas e Armazenamento continuam iguais)
  @ViewChild('chartTemperatura') chartTemperaturaCanvas: ElementRef | undefined;
  @ViewChild('chartPH') chartPHCanvas: ElementRef | undefined;
  @ViewChild('chartTurbidez') chartTurbidezCanvas: ElementRef | undefined;
  private chartInstances: { [key: string]: Chart } = {};

  constructor() { }

  ngOnInit() {
    this.carregarDadosIniciais();
  }

  carregarDadosIniciais() {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
    }, 1500); 
  }

  // (Funções de getStatus... continuam iguais)
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


  // --- MUDANÇA 1: Lógica de "toggle" atualizada ---
  toggleGrafico(metrica: string) {
    
    const metricaSendoAberta = metrica;
    const metricaAbertaAtualmente = this.graficoVisivel;
    const tempoAnimacaoCSS = 500; // O tempo do 'max-height' (0.5s)

    // Caso 1: Fechar o gráfico atual (clicou no mesmo)
    if (metricaAbertaAtualmente === metricaSendoAberta) {
      
      this.graficoVisivel = null; // Inicia animação de fechar (fade-out + slide-up)
      
      // Agenda a destruição do gráfico para DEPOIS da animação
      setTimeout(() => {
        if (this.chartInstances[metricaSendoAberta]) {
          this.chartInstances[metricaSendoAberta].destroy();
          delete this.chartInstances[metricaSendoAberta];
        }
      }, tempoAnimacaoCSS); // Espera a animação de 0.5s acabar
      return;
    }

    // Caso 2: Abrir um novo gráfico (ou trocar de gráfico)
    
    // Se houver um gráfico antigo aberto, destrói-o imediatamente
    // (A sua "caixa" vai fechar de qualquer forma, pois o 'graficoVisivel' vai mudar)
    if (metricaAbertaAtualmente && this.chartInstances[metricaAbertaAtualmente]) {
      this.chartInstances[metricaAbertaAtualmente].destroy();
      delete this.chartInstances[metricaAbertaAtualmente];
    }

    // Define o novo gráfico como visível (inicia animação de abrir)
    this.graficoVisivel = metricaSendoAberta;
    
    // Cria o novo gráfico imediatamente
    // (Ele vai aparecer "escondido" pela 'opacity: 0' e o CSS fará o "fade-in")
    this.criarGrafico(metricaSendoAberta);
  }


  // --- MUDANÇA 2: Reativar 'animation: false' ---
  criarGrafico(metrica: string) {
    let canvas: ElementRef | undefined;
    let dadosGrafico: number[] = [];
    let labelsGrafico: string[] = ["10:00", "10:05", "10:10", "10:15", "10:20"];
    let corBorda = '#00796b';
    let corFundo = 'rgba(0, 121, 107, 0.2)';

    // (Lógica do switch...case continua igual)
    switch (metrica) {
      case 'Temperatura':
        canvas = this.chartTemperaturaCanvas;
        dadosGrafico = [22.5, 23.0, 23.2, 23.1, 23.5];
        corBorda = '#0288D1'; 
        corFundo = 'rgba(2, 136, 209, 0.2)';
        break;
      case 'pH':
        canvas = this.chartPHCanvas;
        dadosGrafico = [7.8, 7.9, 8.0, 7.9, 8.1];
        corBorda = '#D32F2F'; 
        corFundo = 'rgba(211, 47, 47, 0.2)';
        break;
      case 'Turbidez':
        canvas = this.chartTurbidezCanvas;
        dadosGrafico = [3.8, 3.9, 4.0, 4.2, 4.2];
        corBorda = '#F57C00'; 
        corFundo = 'rgba(245, 124, 0, 0.2)';
        break;
    }

    if (!canvas) { return; }

    const ctx = canvas.nativeElement.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        // ... (data continua igual)
        labels: labelsGrafico,
        datasets: [{
          label: `Histórico de ${metrica}`,
          data: dadosGrafico,
          fill: true,
          backgroundColor: corFundo,
          borderColor: corBorda,
          borderWidth: 2,
          tension: 0.3
        }]
      },
      options: {
        // A animação de "fade" (opacidade) do CSS
        // deve ser a única animação.
        animation: false, 
        
        responsive: true,
        scales: { y: { beginAtZero: false } },
        plugins: {
          tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
          }
        }
      }
    });

    this.chartInstances[metrica] = chart;
  }
}