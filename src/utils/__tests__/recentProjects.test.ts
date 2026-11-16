import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createBlankProject,
  getRecentProjects,
  saveProjectToRecent,
  deleteProjectFromRecent,
  fetchSharedProjects,
  saveProjectShared,
  deleteProjectShared,
} from '../recentProjects';
import { TutorialProject } from '../../types/tutorial';

describe('recentProjects module', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('createBlankProject should return a complete valid project structure with default values', () => {
    const proj = createBlankProject('Tutorial de Teste');

    expect(proj.id).toMatch(/^project-/);
    expect(proj.metadata.title).toBe('Tutorial de Teste');
    expect(proj.metadata.organization).toBe('NOME DA ORGANIZAÇÃO');
    expect(proj.metadata.logoUrl).toBeDefined();
    expect(proj.steps).toHaveLength(1);
    expect(proj.steps[0].order).toBe(1);
    expect(proj.theme.primaryColor).toBe('#0a335c');
  });

  it('getRecentProjects should return default project on first launch when localStorage is empty', () => {
    const list = getRecentProjects();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBe('projeto-exemplo');
  });

  it('saveProjectToRecent should persist and update project in localStorage', () => {
    const blank = createBlankProject('Projeto Teste 1');
    const updatedList = saveProjectToRecent(blank);

    expect(updatedList.some((p) => p.id === blank.id)).toBe(true);

    const reloaded = getRecentProjects();
    expect(reloaded.some((p) => p.id === blank.id)).toBe(true);
  });

  it('saveProjectToRecent should update existing project instead of duplicating', () => {
    const blank = createBlankProject('Título Original');
    saveProjectToRecent(blank);

    const modified: TutorialProject = {
      ...blank,
      metadata: {
        ...blank.metadata,
        title: 'Título Modificado',
      },
    };

    const list = saveProjectToRecent(modified);
    const matches = list.filter((p) => p.id === blank.id);
    expect(matches).toHaveLength(1);
    expect(matches[0].metadata.title).toBe('Título Modificado');
  });

  it('deleteProjectFromRecent should remove the project from storage', () => {
    const p1 = createBlankProject('P1');
    const p2 = createBlankProject('P2');
    saveProjectToRecent(p1);
    saveProjectToRecent(p2);

    const afterDelete = deleteProjectFromRecent(p1.id);
    expect(afterDelete.some((p) => p.id === p1.id)).toBe(false);
    expect(afterDelete.some((p) => p.id === p2.id)).toBe(true);
  });

  it('fetchSharedProjects should fetch from /api/projects and cache in localStorage', async () => {
    const remoteProjects: TutorialProject[] = [createBlankProject('Remoto 1')];

    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => remoteProjects,
    } as Response);

    const result = await fetchSharedProjects();
    expect(result).toHaveLength(1);
    expect(result[0].metadata.title).toBe('Remoto 1');
    expect(global.fetch).toHaveBeenCalledWith('/api/projects');
  });

  it('fetchSharedProjects should fall back to localStorage if API request fails', async () => {
    const local = createBlankProject('Local Cache');
    saveProjectToRecent(local);

    // Mock fetch error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchSharedProjects();
    expect(result.some((p) => p.id === local.id)).toBe(true);
  });

  it('saveProjectShared should call /api/projects with POST', async () => {
    const proj = createBlankProject('Projeto Compartilhado');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as Response);

    await saveProjectShared(proj);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('deleteProjectShared should call /api/projects/:id with DELETE', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as Response);

    await deleteProjectShared('proj-123');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/proj-123',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
