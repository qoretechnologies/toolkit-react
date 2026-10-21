import { create } from 'zustand';
import { IReqraftFetchResponse, isQueryCancelled, query } from '../../utils/fetch';

/**
 * The interactive support session a current user is in, when it is one (qorus#693
 * Layer 3): a staff member reading a customer's workspace in the IDE, read-only, as
 * the workspace's support reader. Exactly what the server puts on the request context
 * for such a session, never a token. Absent for every ordinary user.
 */
export interface ICurrentUserSupportSession {
  /** the session's id on the control plane */
  session_id: string;
  /** the customer's grant the session runs under */
  grant_id: string;
  /** the ticket the grant belongs to */
  ticket_id: string;
  /** the ticket's number, for display */
  ticket_number?: number;
  /** the control-plane staff identity the session belongs to */
  actor: string;
  /** the staff member's display name, when the control plane has it */
  actor_name?: string;
  /** the workspace's portable namespace */
  group_namespace: number;
  /** the workspace group's name */
  group_name?: string;
  /** the identity profile, `workspace-read` */
  profile: string;
  /** when the session ends at the latest: the grant's expiry (ISO 8601) */
  expires: string;
  /** where the IDE opens — `kind` and `name` or `id` — when the staff member came from a reference */
  target?: Record<string, unknown>;
  /** the control-plane page to return to */
  portal_url?: string;
}

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
  /**
   * Whether the user's storage can be written back to the server. `false` for an
   * identity whose storage is not its own to keep — an interactive support session
   * reads a workspace as its reader principal — and then every storage write stays
   * in memory for the page's lifetime (see `ReqraftUserProvider`). Absent means
   * writable, as on every server from before the flag.
   */
  storage_writable?: boolean;
  /** present only in an interactive support session (qorus#693 Layer 3) */
  support_session?: ICurrentUserSupportSession;
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
