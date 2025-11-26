import { Injectable, Logger } from '@nestjs/common';
import { HttpService as NestHttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Observable, firstValueFrom, timeout, retry, catchError } from 'rxjs';

@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);
  private readonly DEFAULT_TIMEOUT = 10000;
  private readonly DEFAULT_RETRIES = 2;

  constructor(private readonly httpService: NestHttpService) {}

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(url, config).pipe(
          timeout(config?.timeout || this.DEFAULT_TIMEOUT),
          retry(this.DEFAULT_RETRIES),
          catchError((error) => {
            this.logger.error(`HTTP GET error: ${url}`, error);
            throw error;
          }),
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`HTTP GET failed: ${url}`, error);
      throw error;
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(url, data, config).pipe(
          timeout(config?.timeout || this.DEFAULT_TIMEOUT),
          retry(this.DEFAULT_RETRIES),
          catchError((error) => {
            this.logger.error(`HTTP POST error: ${url}`, error);
            throw error;
          }),
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`HTTP POST failed: ${url}`, error);
      throw error;
    }
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.patch<T>(url, data, config).pipe(
          timeout(config?.timeout || this.DEFAULT_TIMEOUT),
          retry(this.DEFAULT_RETRIES),
          catchError((error) => {
            this.logger.error(`HTTP PATCH error: ${url}`, error);
            throw error;
          }),
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`HTTP PATCH failed: ${url}`, error);
      throw error;
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.delete<T>(url, config).pipe(
          timeout(config?.timeout || this.DEFAULT_TIMEOUT),
          retry(this.DEFAULT_RETRIES),
          catchError((error) => {
            this.logger.error(`HTTP DELETE error: ${url}`, error);
            throw error;
          }),
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`HTTP DELETE failed: ${url}`, error);
      throw error;
    }
  }
}
