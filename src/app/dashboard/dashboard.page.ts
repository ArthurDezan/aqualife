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

  ph: number = 0;
  turbidez: number = 0;

  histPH: number[] = [];
  histTurbidez: number[] = [];
  labelsTempo: string[] = [];

  private updateInterval: any;

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

  // --- NOVA FUNÇÃO "BLINDADA" PARA CONVERTER DATAS ---
  private converterParaTimestamp(item: any): number {
    let valorData = item.timestamp; // ← Sua API sempre envia "timestamp"

    if (!valorData || typeof valorData !== "string") {
      // fallback pelo ObjectId do MongoDB
      if (item._id) {
        try {
          return parseInt(item._id.substring(0, 8), 16) * 1000;
        } catch (e) { return 0; }
      }
      return 0;
    }

    // Formato 100% compatível com sua API
    // Ex: "03/12/2025, 08:10:43"
    const regex = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/;
    const partes = valorData.match(regex);

    if (!partes) return 0;

    const dia = Number(partes[1]);
    const mes = Number(partes[2]) - 1; // JS começa o mês no zero
    const ano = Number(partes[3]);
    const hora = Number(partes[4]);
    const min = Number(partes[5]);
    const seg = Number(partes[6]);

    return new Date(ano, mes, dia, hora, min, seg).getTime();
  }

  buscarDadosApi() {
    this.apiService.getDadosSensores().subscribe({
      next: (dados: any) => {

        if (Array.isArray(dados) && dados.length > 0) {

          // Debug para ver o que está a acontecer
          // console.log('Dado Bruto (Antes de ordenar):', dados[0]);

          // --- ORDENAÇÃO ---
          dados.sort((a: any, b: any) =>
            this.converterParaTimestamp(a) - this.converterParaTimestamp(b)
          );
          // -----------------

          const leituraAtual = dados[dados.length - 1];
          console.log('✅ Leitura Mais Recente (Final):', leituraAtual);

          this.ph = Number(leituraAtual.PH);
          this.turbidez = Number(leituraAtual.turbidez || 0);

          const ultimos10 = dados.slice(-10);

          this.histPH = ultimos10.map((d: any) => Number(d.PH));
          this.histTurbidez = ultimos10.map((d: any) => Number(d.turbidez || 0));

          // Usar a data real da API
          this.labelsTempo = ultimos10.map((d: any) => {
            const regex = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/;
            const partes = d.timestamp.match(regex);

            if (partes) {
              return `${partes[1]}/${partes[2]} ${partes[4]}:${partes[5]}`;
              // ex: "03/12 08:10"
            }

            return '';
          });

        } else {
          console.warn('⚠️ Lista vazia:', dados);
        }

        this.isLoading = false;

        if (this.graficoVisivel) {
          this.atualizarGraficoAberto();
        }
      },
      error: (erro) => {
        console.error('❌ Erro API:', erro);
        this.isLoading = false;
      }
    });
  }

  // --- Funções Auxiliares e Gráficos ---

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