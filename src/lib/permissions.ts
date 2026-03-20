// ─── MÓDULOS ─────────────────────────────────────────────────────────────────
export type Module =
  | 'club'        // Panel coordinación
  | 'agenda'      // Agenda
  | 'tablon'      // Tablón de anuncios
  | 'equipo'      // Equipo / Plantilla
  | 'mensajeria'  // Mensajería
  | 'ojeador'     // Ojeador
  | 'biblioteca'  // Biblioteca
  | 'tesoreria'   // Tesorería
  | 'informes'    // Informes
  | 'admin'       // Gestión de usuarios

export type Role = 'admin' | 'coordinator' | 'secretario' | 'ejecutivo' | 'coach' | 'scout' | 'psychologist'

// ─── MATRIZ DE PERMISOS POR ROL ───────────────────────────────────────────────
// [can_view, can_edit]
type PermMatrix = Record<Module, [boolean, boolean]>

export const ROLE_PERMISSIONS: Record<Role, PermMatrix> = {
  admin: {
    club:       [true, true],
    agenda:     [true, true],
    tablon:     [true, true],
    equipo:     [true, true],
    mensajeria: [true, true],
    ojeador:    [true, true],
    biblioteca: [true, true],
    tesoreria:  [true, true],
    informes:   [true, true],
    admin:      [true, true],
  },
  coordinator: {
    club:       [true, true],
    agenda:     [true, true],
    tablon:     [true, true],
    equipo:     [true, true],
    mensajeria: [true, true],
    ojeador:    [true, true],
    biblioteca: [true, true],
    tesoreria:  [true, true],
    informes:   [true, true],
    admin:      [false, false],
  },
  secretario: {
    club:       [true, false],
    agenda:     [true, true],
    tablon:     [true, true],
    equipo:     [true, false],
    mensajeria: [true, true],
    ojeador:    [false, false],
    biblioteca: [true, true],
    tesoreria:  [true, true],
    informes:   [true, false],
    admin:      [false, false],
  },
  ejecutivo: {
    club:       [true, false],
    agenda:     [true, false],
    tablon:     [true, true],
    equipo:     [false, false],
    mensajeria: [true, true],
    ojeador:    [false, false],
    biblioteca: [true, false],
    tesoreria:  [true, true],
    informes:   [true, false],
    admin:      [false, false],
  },
  coach: {
    club:       [false, false],
    agenda:     [true, false],   // Ve su equipo + partidos/torneos, solo solicitar
    tablon:     [true, false],
    equipo:     [true, true],    // Solo su equipo (control en componente)
    mensajeria: [true, true],
    ojeador:    [false, false],
    biblioteca: [true, false],
    tesoreria:  [false, false],
    informes:   [true, false],   // Solo informes de su equipo
    admin:      [false, false],
  },
  scout: {
    club:       [false, false],
    agenda:     [false, false],
    tablon:     [true, false],
    equipo:     [false, false],
    mensajeria: [true, true],
    ojeador:    [true, true],
    biblioteca: [true, false],
    tesoreria:  [false, false],
    informes:   [false, false],
    admin:      [false, false],
  },
  psychologist: {
    club:       [false, false],
    agenda:     [false, false],
    tablon:     [true, false],
    equipo:     [true, true],    // Solo su equipo (control en componente)
    mensajeria: [true, true],
    ojeador:    [false, false],
    biblioteca: [true, false],
    tesoreria:  [false, false],
    informes:   [false, false],
    admin:      [false, false],
  },
}

// ─── TIPOS ────────────────────────────────────────────────────────────────────
export interface UserPerms {
  can_view: boolean
  can_edit: boolean
}

export interface UserPermOverride {
  module: Module
  can_view: boolean
  can_edit: boolean
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────
// Devuelve permisos efectivos: rol base + override individual si existe
export function getPermissions(
  role: string,
  module: Module,
  overrides: UserPermOverride[] = []
): UserPerms {
  const roleKey = role as Role
  const base = ROLE_PERMISSIONS[roleKey]?.[module] ?? [false, false]

  // Buscar override individual para este módulo
  const override = overrides.find(o => o.module === module)
  if (override) {
    return { can_view: override.can_view, can_edit: override.can_edit }
  }

  return { can_view: base[0], can_edit: base[1] }
}

export function canView(role: string, module: Module, overrides: UserPermOverride[] = []): boolean {
  return getPermissions(role, module, overrides).can_view
}

export function canEdit(role: string, module: Module, overrides: UserPermOverride[] = []): boolean {
  return getPermissions(role, module, overrides).can_edit
}

// ─── MÓDULOS VISIBLES EN BOTTOMNAV ───────────────────────────────────────────
export function getVisibleModules(role: string, overrides: UserPermOverride[] = []): Module[] {
  const all: Module[] = ['club', 'agenda', 'equipo', 'mensajeria', 'ojeador', 'biblioteca', 'tesoreria', 'informes']
  return all.filter(m => canView(role, m, overrides))
}

// ─── ETIQUETAS DE MÓDULOS ────────────────────────────────────────────────────
export const MODULE_LABELS: Record<Module, string> = {
  club:       'Panel coordinación',
  agenda:     'Agenda',
  tablon:     'Tablón',
  equipo:     'Equipo',
  mensajeria: 'Mensajes',
  ojeador:    'Ojeador',
  biblioteca: 'Biblioteca',
  tesoreria:  'Tesorería',
  informes:   'Informes',
  admin:      'Usuarios',
}