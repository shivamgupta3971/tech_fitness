import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "FitVeda Account",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "e.g. shiva" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = typeof credentials?.username === "string" ? credentials.username.trim() : "";
        if (!username) return null;

        // Credentials provider accepting user
        return {
          id: username.toLowerCase(),
          name: username,
          email: `${username.toLowerCase()}@fitveda.app`,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET || "fitveda-neon-auth-secret-key-2026-safe-guard",
});
