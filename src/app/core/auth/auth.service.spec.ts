import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { of, throwError } from 'rxjs';

describe('AuthService', () => {
    let service: AuthService;
    let oidcSecurityServiceSpy: jest.Mocked<OidcSecurityService>;

    beforeEach(() => {
        const spy = {
            checkAuth: jest.fn().mockReturnValue(of({ isAuthenticated: false, userData: null, accessToken: '' })),
            authorize: jest.fn(),
            logoff: jest.fn().mockReturnValue(of(null)),
            getAccessToken: jest.fn().mockReturnValue('mock-token'),
        };

        TestBed.configureTestingModule({
            providers: [
                { provide: OidcSecurityService, useValue: spy }
            ]
        });

        service = TestBed.inject(AuthService);
        oidcSecurityServiceSpy = TestBed.inject(OidcSecurityService) as jest.Mocked<OidcSecurityService>;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('Initialization', () => {
        it('should set ready to true after checkAuth completes', async () => {
            await service.init();
            expect(service.ready()).toBe(true);
        });

        it('should set authenticated state when checkAuth returns success', async () => {
            // Re-configure for this specific test
            const successSpy = { ...oidcSecurityServiceSpy, checkAuth: jest.fn().mockReturnValue(of({ isAuthenticated: true, userData: { sub: '123', name: 'Test User' }, accessToken: 'token' })) };

            TestBed.resetTestingModule();
            TestBed.configureTestingModule({
                providers: [
                    { provide: OidcSecurityService, useValue: successSpy }
                ]
            });
            const successService = TestBed.inject(AuthService);
            await successService.init();

            expect(successService.isAuthenticated()).toBe(true);
            expect(successService.profile()?.name).toBe('Test User');
        });
    });

    describe('Login/Logout', () => {
        it('should call authorize on login', () => {
            service.login('config-id');
            expect(oidcSecurityServiceSpy.authorize).toHaveBeenCalledWith('config-id');
        });

        it('should call logoff and clear state on logout', () => {
            service.logout('config-id');
            expect(oidcSecurityServiceSpy.logoff).toHaveBeenCalledWith('config-id');
            expect(service.isAuthenticated()).toBe(false);
        });

        it('should force local logout on logoff error', () => {
            oidcSecurityServiceSpy.logoff.mockReturnValue(throwError(() => new Error('Network error')));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

            service.logout();

            expect(consoleSpy).toHaveBeenCalled();
            expect(service.isAuthenticated()).toBe(false);
            consoleSpy.mockRestore();
        });
    });

    describe('Roles', () => {
        it('should return true for existing role', async () => {
            // Setup service with roles
            const roleSpy = { ...oidcSecurityServiceSpy, checkAuth: jest.fn().mockReturnValue(of({ isAuthenticated: true, userData: { groups: ['admins', 'users'] }, accessToken: 'token' })) };

            TestBed.resetTestingModule();
            TestBed.configureTestingModule({
                providers: [
                    { provide: OidcSecurityService, useValue: roleSpy }
                ]
            });
            const roleService = TestBed.inject(AuthService);
            await roleService.init();

            expect(roleService.hasRole('admins')).toBe(true);
            expect(roleService.hasRole('superusers')).toBe(false);
        });
    });

    describe('Token', () => {
        it('should return token string', async () => {
            const token = await service.token();
            expect(token).toBe('mock-token');
        });

        it('should handle observable token', async () => {
            oidcSecurityServiceSpy.getAccessToken.mockReturnValue(of('obs-token'));
            const token = await service.token();
            expect(token).toBe('obs-token');
        });
    });
});
