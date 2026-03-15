// This file acts as a bridge. It tells the old UI to use the new Python logic.

export const base44 = {
  auth: {
    // Automatically logs you in as a Guest
    me: async () => ({ 
      email: "guest@captionstudio.io", 
      id: "guest_user", 
      role: "admin" 
    }),
  },
  functions: {
    // Fakes the old server calls so the UI doesn't crash
    invoke: async (functionName, payload) => {
      console.log(`Bypassed call to: ${functionName}`, payload);
      return { 
        data: { 
          success: true, 
          credits: { remaining: 30, total: 30 },
          segments: [] 
        } 
      };
    },
  },
  // Dummy database connectors to prevent crashes
  asServiceRole: {
    entities: {
      RenderJob: { 
        create: async () => ({ id: "job_123" }), 
        update: async () => ({}) 
      },
      UserCredits: { 
        filter: async () => ([{ credits_remaining: 30 }]) 
      }
    }
  }
};