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

  ph: number = 0;
  turbidez: number = 0;
  
  // Lista para o caso de usares o novo HTML
  metrics: any[] = [];

  histPH: number[] = [];
  histTurbidez: number[] = [];
  labelsTempo: string[] = [];

  private updateInterval: any;
  
  // Variáveis para controlar o "Anti-Spam" das notificações
  private ultimoAlerta: number = 0;
  private readonly INTERVALO_ALERTA = 1000 * 60 * 10; // 10 minutos

  @ViewChild('chartPH') chartPHCanvas: ElementRef | undefined;
  @ViewChild('chartTurbidez') chartTurbidezCanvas: ElementRef | undefined;

  private chartInstances: { [key: string]: Chart } = {};

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

  // --- FUNÇÕES DE COMPATIBILIDADE (CORREÇÃO DO ERRO) ---
  // Estas funções ligam o HTML antigo à nova lógica
  getStatusPH() {
    const status = this.calcularStatusPH(this.ph);
    // Retorna a classe CSS baseada no status
    return 'border-' + status.toLowerCase();
  }

  getStatusTurbidez() {
    const status = this.calcularStatusTurbidez(this.turbidez);
    return 'border-' + status.toLowerCase();
  }
  // -----------------------------------------------------

  async verificarAlertas(ph: number, turbidez: number) {
    const agora = Date.now();
    if (agora - this.ultimoAlerta < this.INTERVALO_ALERTA) {
      return;
    }

    let problemas: string[] = [];

    if (turbidez > 20) {
      problemas.push(`⚠️ Turbidez Alta: ${turbidez} NTU`);
    }

    if (ph < 6 || ph > 8) {
      problemas.push(`☠️ pH Crítico: ${ph}`);
    }

    if (problemas.length > 0) {
      const corpoMensagem = problemas.join('\n');
      await LocalNotifications.schedule({
        notifications: [
          {
            title: '🚨 Alerta Aqualife!',
            body: corpoMensagem,
            id: 1,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'beep.wav',
            smallIcon: 'ic_stat_alarm'
          }
        ]
      });
      this.ultimoAlerta = agora;
    }
  }

  openChartModal(metric: any) {
    this.toggleGrafico(metric.key);
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

          this.verificarAlertas(this.ph, this.turbidez);

          this.metrics = [
            {
              key: 'pH',
              name: 'pH da Água',
              value: this.ph,
              unit: 'pH',
              status: this.calcularStatusPH(this.ph)
            },
            {
              key: 'Turbidez',
              name: 'Turbidez',
              value: this.turbidez,
              unit: 'NTU',
              status: this.calcularStatusTurbidez(this.turbidez)
            }
          ];

          const ultimos10 = dados.slice(-10);
          this.histPH = ultimos10.map((d: any) => Number(d.PH));
          this.histTurbidez = ultimos10.map((d: any) => Number(d.turbidez || 0));

          this.labelsTempo = ultimos10.map((d: any) => {
            const regex = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/;
            const partes = d.timestamp.match(regex);
            return partes ? `${partes[1]}/${partes[2]} ${partes[4]}:${partes[5]}` : '';
          });

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

  calcularStatusPH(valor: number): string {
    if (valor < 6.5 || valor > 8.0) return 'Danger';
    if (valor < 7.0 || valor > 7.6) return 'Warning';
    return 'Safe';
  }

  calcularStatusTurbidez(valor: number): string {
    if (valor > 5.0) return 'Danger';
    if (valor > 3.0) return 'Warning';
    return 'Safe';
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