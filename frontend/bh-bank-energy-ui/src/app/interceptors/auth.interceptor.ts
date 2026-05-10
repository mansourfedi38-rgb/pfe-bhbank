import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getAccessToken();
    const isApiRequest = req.url.startsWith('/api');
    const isAuthRequest = req.url.startsWith('/api/auth/login/') || req.url.startsWith('/api/auth/refresh/');

    if (token && isApiRequest) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 401 || !isApiRequest || isAuthRequest || !this.auth.getRefreshToken()) {
          return throwError(() => error);
        }

        return this.auth.refreshAccessToken().pipe(
          switchMap(() => {
            const refreshedToken = this.auth.getAccessToken();
            const refreshedReq = refreshedToken
              ? req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${refreshedToken}`
                  }
                })
              : req;

            return next.handle(refreshedReq);
          }),
          catchError((refreshError) => {
            this.auth.logout();
            return throwError(() => refreshError);
          })
        );
      })
    );
  }
}
