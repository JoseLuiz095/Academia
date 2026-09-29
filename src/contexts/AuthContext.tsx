import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Workspace } from '../types'

type AuthState = {
  user: User | null
  loading: boolean
  authError: string | null
  workspaces: Workspace[]
  workspace: Workspace | null
  isMaster: boolean
  selectWorkspace: (id: string) => void
  refresh: () => Promise<{ user: User | null; isMaster: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const selectedWorkspaceKey = 'academia:selected-workspace'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isMaster, setIsMaster] = useState(false)
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(selectedWorkspaceKey))
  const requestId = useRef(0)
  const pendingRefresh = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    if (pendingRefresh.current !== null) {
      window.clearTimeout(pendingRefresh.current)
      pendingRefresh.current = null
    }
    const currentRequest = ++requestId.current
    setLoading(true)
    setAuthError(null)
    try {
      if (!supabase) {
        setUser(null); setWorkspaces([]); setIsMaster(false)
        return { user: null, isMaster: false }
      }
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError && userError.name !== 'AuthSessionMissingError') throw userError
      const currentUser = userData.user
      if (!currentUser) {
        if (currentRequest === requestId.current) {
          setUser(null); setWorkspaces([]); setIsMaster(false)
        }
        return { user: null, isMaster: false }
      }

      const [memberResult, ownedResult, masterResult] = await Promise.all([
        supabase.from('workspace_members').select('workspace_id').eq('user_id', currentUser.id),
        supabase.from('workspaces').select('id').eq('owner_id', currentUser.id),
        supabase.from('platform_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle(),
      ])
      if (memberResult.error) throw memberResult.error
      if (ownedResult.error) throw ownedResult.error
      if (masterResult.error) throw masterResult.error
      const ids = Array.from(new Set([
        ...(memberResult.data ?? []).map((item) => item.workspace_id as string),
        ...(ownedResult.data ?? []).map((item) => item.id as string),
      ]))
      let availableWorkspaces: Workspace[] = []
      if (ids.length) {
        const { data, error } = await supabase.from('workspaces')
          .select('id,owner_id,name,slug,niche,description,whatsapp_number,pix_key,pix_receiver,pix_city,service_cities,published,plan_code,subscription_status,subscription_started_at,subscription_ends_at,store_settings,approval_status,approved_at,approved_by,created_at')
          .in('id', ids)
          .order('created_at', { ascending: true })
        if (error) throw error
        availableWorkspaces = (data ?? []) as Workspace[]
      }
      if (currentRequest !== requestId.current) throw new Error('A sessão mudou durante a validação. Tente novamente.')
      setUser(currentUser)
      setWorkspaces(availableWorkspaces)
      setIsMaster(Boolean(masterResult.data))
      return { user: currentUser, isMaster: Boolean(masterResult.data) }
    } catch (error) {
      if (currentRequest === requestId.current) {
        setUser(null)
        setWorkspaces([])
        setIsMaster(false)
        setAuthError('Não foi possível validar a sessão ou as permissões. Tente novamente.')
      }
      throw error
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh().catch(() => {})
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // O login/cadastro chama refresh explicitamente. Uma segunda chamada aqui
      // disputava a sessão e podia anular a validação do Admin Master.
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') return
      if (event === 'SIGNED_OUT') {
        if (pendingRefresh.current !== null) window.clearTimeout(pendingRefresh.current)
        pendingRefresh.current = null
        ++requestId.current
        setUser(null)
        setWorkspaces([])
        setIsMaster(false)
        setAuthError(null)
        setLoading(false)
        setSelectedId(null)
        localStorage.removeItem(selectedWorkspaceKey)
        return
      }
      pendingRefresh.current = window.setTimeout(() => {
        pendingRefresh.current = null
        void refresh().catch(() => {})
      }, 0)
    })
    return () => {
      if (pendingRefresh.current !== null) window.clearTimeout(pendingRefresh.current)
      data.subscription.unsubscribe()
    }
  }, [refresh])

  const workspace = useMemo(
    () => workspaces.find((item) => item.id === selectedId) ?? workspaces[0] ?? null,
    [workspaces, selectedId],
  )

  const selectWorkspace = (id: string) => {
    if (!workspaces.some((item) => item.id === id)) return
    setSelectedId(id)
    localStorage.setItem(selectedWorkspaceKey, id)
  }

  const signOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }
    ++requestId.current
    setUser(null)
    setWorkspaces([])
    setIsMaster(false)
    setAuthError(null)
    setSelectedId(null)
    localStorage.removeItem(selectedWorkspaceKey)
  }

  return <AuthContext.Provider value={{ user, loading, authError, workspaces, workspace, isMaster, selectWorkspace, refresh, signOut }}>
    {children}
  </AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider ausente')
  return context
}
