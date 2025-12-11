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
  @Input() titulo: string = 'Gráfico';
  @Input() dados: number[] = [];
  
  // AQUI está o segredo: Vamos receber as labels, mas vamos processá-las antes de usar
  private _labels: string[] = [];
  
  @Input() 
  set labels(value: string[]) {
    // Quando os dados entram, vamos formatá-los imediatamente
    // Transformamos "11/12/2024, 07:11:53" em apenas "07:11"
    this._labels = value.map(label => {
      // Tenta separar por vírgula ou espaço para pegar só a hora
      const partes = label.split(' '); // Assume que há um espaço entre data e hora
      
      // Se encontrar mais de uma parte (ex: Data e Hora), pega a última (Hora)
      if (partes.length > 1) {
        // Remove os segundos se existirem (pega os primeiros 5 caracteres da hora: "07:11")
        return partes[partes.length - 1].substring(0, 5); 
      }
      
      return label;
    });
  }
  
  get labels(): string[] {
    return this._labels;
  }

  @ViewChild('chartCanvas') chartCanvas: ElementRef | undefined;
  
  private chart: Chart | undefined;

  constructor(private modalCtrl: ModalController) { }

  ngAfterViewInit() {
    this.criarGrafico();
  }

  fechar() {
    this.modalCtrl.dismiss();
  }

  criarGrafico() {
    if (!this.chartCanvas) {
      console.error("Elemento canvas não encontrado!");
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this._labels, // Usa as labels já curtas ("07:11", "07:12", etc.)
        datasets: [{
          label: this.titulo,
          data: this.dados,
          fill: true,
          backgroundColor: 'rgba(0, 121, 107, 0.2)',
          borderColor: '#00796b',
          borderWidth: 2,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6 // Garante que não mostra demasiadas horas
            }
          },
          y: {
            beginAtZero: false
          }
        }
      }
    });
  }
}