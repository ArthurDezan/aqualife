import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-metric-chart-modal',
  templateUrl: './metric-chart-modal.component.html',
  styleUrls: ['./metric-chart-modal.component.scss'],
  standalone: false
})
export class MetricChartModalComponent implements AfterViewInit {

  // --- Variáveis de Entrada ---
  // O 'Input' permite que a página do dashboard envie dados para este modal
  @Input() titulo: string = 'Gráfico'; // Título (ex: "Temperatura")
  @Input() dados: number[] = [];     // Os valores (ex: [22, 23, 22.5])
  @Input() labels: string[] = [];    // As legendas (ex: ["10:00", "10:05", "10:10"])

  // --- Referência ao Canvas ---
  // Vamos "agarrar" o elemento <canvas> do nosso HTML para desenhar o gráfico
  @ViewChild('chartCanvas') chartCanvas: ElementRef | undefined;
  
  private chart: Chart | undefined;

  constructor(private modalCtrl: ModalController) { }

  // Usamos AfterViewInit em vez de OnInit para garantir que o <canvas> já existe no HTML
  ngAfterViewInit() {
    this.criarGrafico();
  }

  // Função para fechar o modal
  fechar() {
    this.modalCtrl.dismiss();
  }

  // Função para criar o gráfico
  criarGrafico() {
    if (!this.chartCanvas) {
      console.error("Elemento canvas não encontrado!");
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');

    // Usamos os dados que recebemos via @Input
    this.chart = new Chart(ctx, {
      type: 'line', // Tipo de gráfico: linha
      data: {
        labels: this.labels, // Legendas do eixo X
        datasets: [{
          label: this.titulo,
          data: this.dados, // Valores do eixo Y
          fill: true,
          backgroundColor: 'rgba(0, 121, 107, 0.2)', // Azul claro/verde (tom de água)
          borderColor: '#00796b', // Azul/verde mais escuro
          borderWidth: 2,
          tension: 0.3 // Deixa a linha ligeiramente curva
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: false // O eixo Y não precisa começar no zero
          }
        }
      }
    });
  }
}