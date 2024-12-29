//import NextAuth from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { createGuest, getGuest } from "./data-service";

const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    //add other providers if needed
  ],

  //for routes protection/authorization
  callbacks: {
    authorized({ auth, request }) {
      return !!auth?.user; //this !! is a trick and short form of boolean, i.e return true if auth.user exisit else return false
    },
    async signIn({ user, account, profile }) {
      try {
        //check if user already exist in DB
        const existingGuest = await getGuest(user.email);

        //create new user if not existing
        if (!existingGuest)
          await createGuest({ email: user.email, fullName: user.name });

        return true;
      } catch {
        return false;
      }
    },

    //get id of the guest for use in the app
    async session({ session, user }) {
      const guest = await getGuest(session.user.email);
      //mutate guest id into guestId
      session.user.guestId = guest.id;

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
};
export const {
  auth,
  signIn,
  signOut,
  handlers: { GET, POST },
} = NextAuth(authConfig);
