import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Apple from "next-auth/providers/apple"
import Credentials from "next-auth/providers/credentials"

const handler = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Google,
    Apple,
    Credentials({
      name: "Dev",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        // DEV ONLY: accept any email/password and fabricate a user id based on email
        if (!creds?.email) return null;
        return { id: `dev_${Buffer.from(String(creds.email)).toString("hex")}`, email: String(creds.email) };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      (session as any).user.id = (token as any).id || token.sub;
      return session;
    }
  }
})

export { handler as GET, handler as POST }
