import { HttpService as NestHttpService } from '@nestjs/axios';
import { AxiosRequestConfig } from 'axios';
export declare class HttpService {
    private readonly httpService;
    private readonly logger;
    private readonly DEFAULT_TIMEOUT;
    private readonly DEFAULT_RETRIES;
    constructor(httpService: NestHttpService);
    get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
    post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
}
