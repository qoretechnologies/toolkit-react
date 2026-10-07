import { create } from 'zustand';
import { IReqraftFetchResponse, isQueryCancelled, query } from '../../utils/fetch';

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
  sandboxed?: boolean;
  default_group?: string;
}

export interface ICurrentUserStore {
  currentUser?: ICurrentUser;
  load: () => Promise<ICurrentUser>;
  loading?: boolean;

  error?: Error;
  errorData?: any;

  hasAnyPermission: (permissions: string[]) => boolean;
  updateStorage: (storage: Record<string, any>) => void;
}

export const currentUserStore = create<ICurrentUserStore>((set, get) => ({
  currentUser: undefined,
  loading: false,
  error: undefined,
  load: async () => {
    set({ loading: true });

    let response: IReqraftFetchResponse<ICurrentUser>;

    try {
      response = await query<ICurrentUser>({ url: 'users?action=current', cache: false });
    } catch (error) {
      /* An abandoned request (the query cache was cleared while it was in
         flight) is not a user that could not be loaded: the store keeps what it
         had and only stops loading - without that, `loading` stayed true for
         good and a `waitForStorage` provider rendered nothing. Anything else
         that throws is a load that failed, and is kept as one. */
      if (isQueryCancelled(error)) {
        set({ loading: false });
      } else {
        set({
          loading: false,
          error: error as Error,
          currentUser: undefined,
          errorData: undefined,
        });
      }

      return Promise.reject(error);
    }

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
  hasAnyPermission: (permissions) => {
    if (!get().currentUser) {
      return false;
    }

    const { currentUser } = get();

    return permissions.some((permission) => currentUser.permissions?.includes(permission));
  },
  updateStorage: (storage) => {
    set((state) => ({ currentUser: { ...state.currentUser, storage } }));
  },
}));
