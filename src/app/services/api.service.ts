import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  // COLE AQUI A URL QUE ESTÁ NO SEU POSTMAN (Collection Dezan)
  // Exemplo hipotético baseado em documentações comuns, substitua pela URL real
  private apiUrl = 'https://esp32-mongodb-idev3.onrender.com/api/leituras/Dezan'; 

  constructor(private http: HttpClient) { }

  // Função que busca os dados atuais
  getDadosSensores(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }
}