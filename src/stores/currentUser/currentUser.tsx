import { create } from 'zustand';
import { query } from '../../utils/fetch';

export interface ICurrentUser {
  provider: string;
  username: string;
  name: string;
  has_default: boolean;
  roles: string[];
  permissions: string[];
  workflows: string[];
  services: string[];
  jobs: string[];
  mappers: string[];
  vmaps: string[];
  groups: string[];
  fsms: string[];
  oauth2_clients?: Record<string, any>[];
  storage?: Record<string, any>;
}

export interface ICurrentUserStore {
  currentUser?: ICurrentUser;
  load: () => Promise<ICurrentUser>;
  loading?: boolean;

  error?: Error;
  errorData?: any;

  hasPermissions: (permissions: string[]) => boolean;
  updateStorage: (storage: Record<string, any>) => void;
}

export const currentUserStore = create<ICurrentUserStore>((set, get) => ({
  currentUser: undefined,
  loading: false,
  error: undefined,
  load: async () => {
    set({ loading: true });

    const response = await query<ICurrentUser>({ url: 'users?action=current', cache: false });

    if (!response.ok) {
      set({
        loading: false,
        error: response.error,
        currentUser: undefined,
        errorData: response.data,
      });

      return Promise.reject(response.error);
    }

    set({ currentUser: response.data, loading: false, errorData: undefined, error: undefined });

    return response.data;
  },
  hasPermissions: (permissions) => {
    if (!get().currentUser) {
      return false;
    }

    const { currentUser } = get();

    return permissions.every((permission) => currentUser.permissions?.includes(permission));
  },
  updateStorage: (storage) => {
    set((state) => ({ currentUser: { ...state.currentUser, storage } }));
  },
}));
