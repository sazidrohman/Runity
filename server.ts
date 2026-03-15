import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { nanoid } from "nanoid";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Room state
  const rooms: Record<string, {
    id: string;
    name: string;
    creator: string;
    users: { id: string; name: string; distance: number; status: 'waiting' | 'running' }[];
    status: 'waiting' | 'running';
    maxParticipants: number;
    targetDistance: number;
    password?: string;
  }> = {};

  // User persistent state (in-memory for now, would be DB in production)
  const users: Record<string, {
    id: string;
    unityCards: number;
    weeklyDistance: number;
    lastClaimedWeek: string; // Format: YYYY-WW
  }> = {};

  const getWeekString = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-${weekNo}`;
  };

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("sync-user", (userData) => {
      users[userData.id] = {
        id: userData.id,
        unityCards: userData.unityCards || 0,
        weeklyDistance: userData.weeklyDistance || 0,
        lastClaimedWeek: userData.lastClaimedWeek || ''
      };
      socket.emit("user-data-synced", users[userData.id]);
    });

    socket.on("claim-unity-card", (userId) => {
      const user = users[userId];
      if (!user) return;

      const now = new Date();
      const currentWeek = getWeekString(now);
      
      if (user.lastClaimedWeek === currentWeek) {
        socket.emit("error", "You have already claimed your Unity Card for this week.");
        return;
      }

      const day = now.getDay(); 
      const hour = now.getHours();

      // Check if it's Friday before 12 PM
      if (day === 5 && hour < 12) {
        if (user.weeklyDistance >= 8) {
          user.unityCards += 1;
          user.lastClaimedWeek = currentWeek;
          user.weeklyDistance = 0; 
          socket.emit("user-data-synced", user);
          socket.emit("success", "Unity Card claimed successfully!");
          // The client will listen for user-data-synced and update Firestore
        } else {
          socket.emit("error", `You need ${(8 - user.weeklyDistance).toFixed(1)} more km to claim your Unity Card.`);
        }
      } else if (day < 5) {
        socket.emit("error", "Unity Cards can only be claimed on Friday before 12:00 PM.");
      } else {
        socket.emit("error", "The deadline for this week's Unity Card (Friday 12:00 PM) has passed.");
      }
    });

    socket.on("join-room", ({ roomId, user, password }) => {
      if (!rooms[roomId]) {
        socket.emit("error", "Room not found");
        return;
      }

      if (rooms[roomId].password && rooms[roomId].password !== password) {
        socket.emit("error", "Incorrect password");
        return;
      }

      const isAlreadyInRoom = rooms[roomId].users.some(u => u.id === user.id);
      
      if (!isAlreadyInRoom && rooms[roomId].users.length >= rooms[roomId].maxParticipants) {
        socket.emit("error", "Room is full");
        return;
      }
      
      socket.join(roomId);
      const roomUser = { ...user, distance: 0, status: 'waiting' as const };
      
      // Remove user if already in room (reconnect)
      rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== user.id);
      rooms[roomId].users.push(roomUser);
      
      io.to(roomId).emit("room-update", rooms[roomId]);
    });

    socket.on("create-room", ({ name, creator, maxParticipants, targetDistance, password }) => {
      const user = users[creator.id];
      if (!user || user.unityCards <= 0) {
        socket.emit("error", "You need a Unity Card to create a room. Complete 8km by Friday 12:00 PM to earn one!");
        return;
      }

      user.unityCards -= 1;
      socket.emit("user-data-synced", user);

      const roomId = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit numeric ID
      rooms[roomId] = {
        id: roomId,
        name,
        creator: creator.id,
        users: [{ ...creator, distance: 0, status: 'waiting' }],
        status: 'waiting',
        maxParticipants: maxParticipants || 10,
        targetDistance: targetDistance || 5,
        password: password
      };
      socket.join(roomId);
      socket.emit("room-created", rooms[roomId]);
      io.emit("available-rooms", Object.values(rooms).filter(r => r.status === 'waiting').map(({ password, ...r }) => r));
    });

    socket.on("update-progress", ({ roomId, userId, distance }) => {
      if (rooms[roomId]) {
        const roomUser = rooms[roomId].users.find(u => u.id === userId);
        if (roomUser) {
          const diff = distance - roomUser.distance;
          roomUser.distance = distance;
          
          // Update weekly distance for Unity Card
          if (users[userId]) {
            users[userId].weeklyDistance += diff;
            socket.emit("user-data-synced", users[userId]);
          }

          io.to(roomId).emit("room-update", rooms[roomId]);
        }
      }
    });

    socket.on("start-race", (roomId) => {
      if (rooms[roomId]) {
        rooms[roomId].status = 'running';
        rooms[roomId].users.forEach(u => u.status = 'running');
        io.to(roomId).emit("race-started", rooms[roomId]);
        io.emit("available-rooms", Object.values(rooms).filter(r => r.status === 'waiting').map(({ password, ...r }) => r));
      }
    });

    socket.on("get-rooms", () => {
      socket.emit("available-rooms", Object.values(rooms).filter(r => r.status === 'waiting').map(({ password, ...r }) => r));
    });

    socket.on("disconnect", () => {
      // Clean up users from rooms
      Object.keys(rooms).forEach(roomId => {
        const initialCount = rooms[roomId].users.length;
        rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
        if (rooms[roomId].users.length !== initialCount) {
          io.to(roomId).emit("room-update", rooms[roomId]);
        }
        // Delete empty rooms
        if (rooms[roomId].users.length === 0) {
          delete rooms[roomId];
          io.emit("available-rooms", Object.values(rooms).filter(r => r.status === 'waiting'));
        }
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
