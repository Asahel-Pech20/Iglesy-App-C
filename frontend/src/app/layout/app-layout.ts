import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  ChevronDown,
  LogOut,
  LucideAngularModule,
  Menu,
  Moon,
  Sun,
  UserRound,
} from 'lucide-angular';
import { map } from 'rxjs';
import { ETIQUETAS_ROL } from '@/app/core/formato';
import { type EntradaMenu, MENU } from '@/app/core/menu';
import { SesionService } from '@/app/core/sesion.service';
import { TemaService } from '@/app/core/tema.service';
import { MarcaIglesia } from './marca-iglesia';

/**
 * Layout principal: barra lateral fija (240 px) + barra superior + contenido.
 * En móvil (< 768 px) el menú se abre como panel desplegable.
 */
@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavContainer,
    MatSidenav,
    MatSidenavContent,
    MatButton,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatDivider,
    MatTooltip,
    LucideAngularModule,
    MarcaIglesia,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayout {
  private readonly sesion = inject(SesionService);
  private readonly temaService = inject(TemaService);

  protected readonly usuario = this.sesion.usuario;
  protected readonly iglesia = this.sesion.iglesia;
  protected readonly etiquetasRol = ETIQUETAS_ROL;
  protected readonly movil = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  protected readonly menuAbierto = signal(false);
  protected readonly entradas = computed(() =>
    MENU.filter((e: EntradaMenu) => !e.permiso || this.sesion.puede(...[e.permiso].flat())),
  );
  protected readonly iconos = { Menu, Sun, Moon, UserRound, ChevronDown, LogOut };

  protected alternarTema() {
    this.temaService.alternar();
  }

  protected cerrarSesion() {
    void this.sesion.cerrarSesion();
  }

  protected alNavegar() {
    if (this.movil()) this.menuAbierto.set(false);
  }
}
