import { HttpClient } from '@angular/common/http';
import { Injectable, inject, Signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subject, merge, timer, switchMap, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
    username: string; // ID / Login (metadata.name)
    name: string;     // Display Name (spec.name)
    email?: string[];
    comment?: string;
    disabled?: boolean;
    uid?: number;
    groups?: string[];
    password?: string; // Write-only
}

export interface Group {
    name: string;
    comment?: string;
    description?: string;
}

@Injectable({
    providedIn: 'root'
})
export class IdentityService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiBaseUrl}/api/v1/identity`;

    // --- Reactive State Management ---
    private readonly usersReloadTrigger$ = new Subject<void>();
    private readonly groupsReloadTrigger$ = new Subject<void>();

    // Users: fetched on init, every 15s, and when triggered
    private readonly users$ = merge(
        timer(0, 15000),
        this.usersReloadTrigger$
    ).pipe(
        switchMap(() => this.http.get<User[]>(`${this.apiUrl}/users`)),
        shareReplay(1)
    );

    // Groups: fetched on init, every 15s, and when triggered
    private readonly groups$ = merge(
        timer(0, 15000),
        this.groupsReloadTrigger$
    ).pipe(
        switchMap(() => this.http.get<Group[]>(`${this.apiUrl}/groups`)),
        shareReplay(1)
    );

    // Expose as Signals for components
    readonly users: Signal<User[]> = toSignal(this.users$, { initialValue: [] });
    readonly groups: Signal<Group[]> = toSignal(this.groups$, { initialValue: [] });

    // Loading states
    readonly usersLoading = computed(() => this.users().length === 0);
    readonly groupsLoading = computed(() => this.groups().length === 0);

    // --- Manual Triggers ---
    refreshUsers(): void {
        this.usersReloadTrigger$.next();
    }

    refreshGroups(): void {
        this.groupsReloadTrigger$.next();
    }

    // --- User CRUD (triggers refresh on success) ---
    getUser(name: string): Observable<User> {
        return this.http.get<User>(`${this.apiUrl}/users/${name}`);
    }

    createUser(user: User): Observable<User> {
        return this.http.post<User>(`${this.apiUrl}/users`, user).pipe(
            tap(() => this.refreshUsers())
        );
    }

    updateUser(name: string, user: User): Observable<User> {
        return this.http.put<User>(`${this.apiUrl}/users/${name}`, user).pipe(
            tap(() => this.refreshUsers())
        );
    }

    deleteUser(name: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/users/${name}`).pipe(
            tap(() => this.refreshUsers())
        );
    }

    // --- Group CRUD (triggers refresh on success) ---
    createGroup(group: Group): Observable<Group> {
        return this.http.post<Group>(`${this.apiUrl}/groups`, group).pipe(
            tap(() => this.refreshGroups())
        );
    }

    updateGroup(name: string, group: Group): Observable<Group> {
        return this.http.put<Group>(`${this.apiUrl}/groups/${name}`, group).pipe(
            tap(() => this.refreshGroups())
        );
    }

    deleteGroup(name: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/groups/${name}`).pipe(
            tap(() => this.refreshGroups())
        );
    }
}

