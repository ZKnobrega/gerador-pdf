import { TutorialProject } from '../types/tutorial';
import { defaultProject } from '../data/defaultProject';

const RECENT_PROJECTS_KEY = 'guiamaker_recent_projects';

export const getRecentProjects = (): TutorialProject[] => {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) {
      // Seed with default project on first launch
      const seeded = [defaultProject];
      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [defaultProject];
  } catch (err) {
    console.error('Erro ao ler projetos recentes:', err);
    return [defaultProject];
  }
};

/**
 * Fetches all shared tutorials from the central server (/api/projects).
 * Falls back to local storage cache if offline or in standalone desktop mode.
 */
export const fetchSharedProjects = async (): Promise<TutorialProject[]> => {
  try {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const serverProjects: TutorialProject[] = await res.json();
      if (Array.isArray(serverProjects) && serverProjects.length > 0) {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(serverProjects));
        return serverProjects;
      }
    }
  } catch {
    // Offline or server not available, use local cache
  }
  return getRecentProjects();
};

export const saveProjectToRecent = (project: TutorialProject): TutorialProject[] => {
  try {
    const recents = getRecentProjects();
    const existingIndex = recents.findIndex((p) => p.id === project.id);

    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
    };

    let updatedList: TutorialProject[];
    if (existingIndex >= 0) {
      updatedList = [...recents];
      updatedList[existingIndex] = updatedProject;
    } else {
      updatedList = [updatedProject, ...recents];
    }

    // Limit to 50 most recent
    if (updatedList.length > 50) {
      updatedList = updatedList.slice(0, 50);
    }

    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updatedList));
    return updatedList;
  } catch (err) {
    console.error('Erro ao salvar em recentes:', err);
    return [];
  }
};

/**
 * Persists project to local storage AND sends it to the central shared server (/api/projects)
 * so anyone on any other computer can see and edit it.
 */
export const saveProjectShared = async (project: TutorialProject): Promise<void> => {
  saveProjectToRecent(project);
  try {
    await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    });
  } catch {
    // Offline fallback already stored in localStorage
  }
};

export const deleteProjectFromRecent = (projectId: string): TutorialProject[] => {
  try {
    const recents = getRecentProjects();
    const filtered = recents.filter((p) => p.id !== projectId);
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.error('Erro ao deletar de recentes:', err);
    return [];
  }
};

/**
 * Deletes project from local storage AND from the central shared server.
 */
export const deleteProjectShared = async (projectId: string): Promise<void> => {
  deleteProjectFromRecent(projectId);
  try {
    await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Ignore offline errors
  }
};

export const createBlankProject = (title = 'Novo Manual do Sistema'): TutorialProject => {
  return {
    id: `project-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    metadata: {
      organization: 'NOME DA ORGANIZAÇÃO',
      title: title,
      subtitle: 'Manual Prático e Guia Operacional',
      systemName: 'SISTEMA',
      badgeText: 'Guia do Usuário',
      logoUrl: null, // no logo by default
      logoHeight: 64,
      purpose: 'Finalidade deste Manual: Apresentar as instruções de uso e operação dos recursos disponíveis.',
      author: 'Departamento de Tecnologia da Informação',
      version: '1.0',
      date: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date()),
    },
    theme: {
      primaryColor: '#0a335c',
      secondaryColor: '#0284c7',
      accentColor: '#ef4444',
      badgeBgColor: '#0a335c',
      badgeTextColor: '#ffffff',
      cardBgColor: '#ffffff',
      cardBorderColor: '#e2e8f0',
      fontFamily: 'Inter',
    },
    support: {
      enabled: true,
      title: 'Central de Atendimento e Suporte de TI',
      description: 'Em caso de dúvidas operacionais ou problemas de acesso, contate a Central de TI:',
      channels: [
        {
          id: 'c1',
          type: 'phone',
          label: 'TELEFONE / RAMAL',
          value: 'Ramal 1000',
        },
        {
          id: 'c2',
          type: 'chat',
          label: 'CHAT INTERNO',
          value: 'Chat na Intranet',
        },
        {
          id: 'c3',
          type: 'email',
          label: 'E-MAIL INSTITUCIONAL',
          value: 'suporte@exemplo.com',
        },
      ],
      department: 'Nome da Organização — Departamento de Tecnologia da Informação',
      footerNote: 'Documento gerado para instrução aos usuários',
    },
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: `step-${Date.now()}-1`,
        order: 1,
        title: 'Acessar a tela inicial do sistema',
        objective: 'Realizar o login e localizar o menu correspondente.',
        instructions: [
          'Acesse o sistema pelo endereço institucional.',
          'Insira suas credenciais de usuário e senha.',
          'Localize a opção desejada no menu lateral.',
        ],
        image: null,
        caption: 'Figura 1: Acesso ao sistema',
        imageWidthPercent: 100,
        callout: null,
        forcePageBreakAfter: false,
      },
    ],
  };
};
