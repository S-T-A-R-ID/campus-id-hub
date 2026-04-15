import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { clearPortalMode, getPortalMode, setPortalMode } from "@/lib/portalMode";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isAdminApproved: boolean;
  pinChanged: boolean;
  profile: any;
  roleLoaded: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  emailVerified: false,
  isAdmin: false,
  isSuperAdmin: false,
  isAdminApproved: false,
  pinChanged: true,
  profile: null,
  roleLoaded: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdminApproved, setIsAdminApproved] = useState(false);
  const [pinChanged, setPinChanged] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [lastAuthEvent, setLastAuthEvent] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      setProfile(data ?? null);
      if (typeof data?.email_verified === "boolean") {
        setEmailVerified(Boolean(data.email_verified));
      }
    } catch {
      setProfile(null);
    }
  };

  const checkAdmin = async (userId: string) => {
    try {
      const { data: adminStateData, error: adminStateError } = await supabase.rpc("current_admin_state_rpc");
      if (!adminStateError) {
        const state = Array.isArray(adminStateData) ? adminStateData[0] : adminStateData;
        if (state && typeof state === "object") {
          const isAdminFromRpc = Boolean(state.is_admin);
          setIsAdmin(isAdminFromRpc);
          setIsSuperAdmin(Boolean(state.is_super_admin));
          setIsAdminApproved(isAdminFromRpc ? Boolean(state.is_admin_approved) : false);
          setPinChanged(isAdminFromRpc ? Boolean(state.pin_changed) : true);
          return;
        }
      }

      let roles: string[] = [];

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!roleError) {
        roles = (roleData || []).map((r) => r.role as string);
      }

      const { data: pinData } = await supabase
        .from("admin_pins")
        .select("is_approved, pin_changed")
        .eq("user_id", userId)
        .maybeSingle();

      // Treat either admin role OR existing admin pin record as admin identity.
      const hasAdminRole = roles.includes("admin") || roles.includes("super_admin");
      const hasAdminPinRecord = Boolean(pinData);
      const adminRole = hasAdminRole || hasAdminPinRecord;

      setIsAdmin(adminRole);
      setIsSuperAdmin(roles.includes("super_admin"));

      if (adminRole) {
        setIsAdminApproved(pinData?.is_approved ?? true);
        setPinChanged(pinData?.pin_changed ?? false);
      } else {
        setIsAdminApproved(false);
        setPinChanged(true);
      }
    } catch {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setIsAdminApproved(false);
      setPinChanged(true);
    } finally {
      setRoleLoaded(true);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLastAuthEvent(_event);
        if (_event === "TOKEN_REFRESH_FAILED") {
          await supabase.auth.signOut();
          clearPortalMode();
          setUser(null);
          setSession(null);
          setProfile(null);
          setEmailVerified(false);
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setIsAdminApproved(false);
          setPinChanged(true);
          setRoleLoaded(true);
          setLoading(false);
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        setEmailVerified(Boolean(session?.user?.email_confirmed_at));
        if (session?.user) {
          setRoleLoaded(false);
          setTimeout(() => {
            fetchProfile(session.user.id);
            checkAdmin(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setEmailVerified(false);
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setIsAdminApproved(false);
          setPinChanged(true);
          setRoleLoaded(true);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setEmailVerified(Boolean(session?.user?.email_confirmed_at));
      if (session?.user) {
        setRoleLoaded(false);
        fetchProfile(session.user.id);
        checkAdmin(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roleLoaded) return;
    if (getPortalMode()) return;
    setPortalMode(isAdmin ? "admin" : "student");
  }, [user, roleLoaded, isAdmin]);

  useEffect(() => {
    if (!user || !roleLoaded) return;
    if (!isAdmin) return;
    if (lastAuthEvent !== "INITIAL_SESSION") return;

    // Force admins to re-enter PIN on refresh; keep student sessions persistent.
    void (async () => {
      await supabase.auth.signOut();
      clearPortalMode();
      setUser(null);
      setSession(null);
      setProfile(null);
      setEmailVerified(false);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setIsAdminApproved(false);
      setPinChanged(true);
      setRoleLoaded(true);
      setLoading(false);
    })();
  }, [user, roleLoaded, isAdmin, lastAuthEvent]);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearPortalMode();
    setUser(null);
    setSession(null);
    setProfile(null);
    setEmailVerified(false);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setIsAdminApproved(false);
    setPinChanged(true);
    setRoleLoaded(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, emailVerified, isAdmin, isSuperAdmin, isAdminApproved, pinChanged, profile, signOut, refreshProfile, roleLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}
