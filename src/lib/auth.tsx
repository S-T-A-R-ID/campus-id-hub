import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { clearPortalMode } from "@/lib/portalMode";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdminApproved, setIsAdminApproved] = useState(false);
  const [pinChanged, setPinChanged] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      setProfile(data);
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
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setRoleLoaded(false);
          setTimeout(() => {
            fetchProfile(session.user.id);
            checkAdmin(session.user.id);
          }, 0);
        } else {
          setProfile(null);
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
      if (session?.user) {
        setRoleLoaded(false);
        fetchProfile(session.user.id);
        checkAdmin(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearPortalMode();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setIsAdminApproved(false);
    setPinChanged(true);
    setRoleLoaded(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isSuperAdmin, isAdminApproved, pinChanged, profile, signOut, refreshProfile, roleLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}
