import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  // O endereço da tua API (baseado no que partilhaste)
  private apiUrl = 'https://esp32-mongodb-idev3.onrender.com/api/leituras/Dezan'; 

  constructor(private http: HttpClient) { }

  // Função chamada pelo Dashboard para receber a lista de dados
  getDadosSensores(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }
}