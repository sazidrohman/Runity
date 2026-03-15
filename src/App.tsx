/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot 
} from './firebase';
import { 
  Activity as ActivityIcon, 
  History, 
  Settings, 
  Plus, 
  Play, 
  Square, 
  Pause,
  MapPin, 
  TrendingUp, 
  Award,
  ChevronRight,
  Clock,
  Flame,
  User as UserIcon,
  Users,
  Trophy,
  Zap,
  ArrowLeft,
  Share2,
  Search,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Globe,
  Heart,
  MessageSquare,
  MessageCircle,
  Bot,
  Send,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { io, Socket } from 'socket.io-client';
import { nanoid } from 'nanoid';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';

// Fix Leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Distance calculation (Haversine formula)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Map Updater Component
const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

// Types
interface RoomUser {
  id: string;
  name: string;
  distance: number;
  status: 'waiting' | 'running';
}

interface Room {
  id: string;
  name: string;
  creator: string;
  users: RoomUser[];
  status: 'waiting' | 'running';
  maxParticipants: number;
  targetDistance: number;
  password?: string;
}

// Mock Data
const MOCK_ACTIVITIES = [
  { 
    id: '1', 
    date: '2024-03-10', 
    distance: 5.2, 
    duration: 1840, 
    pace: '5:54', 
    calories: 420, 
    route: 'Morning Park Run',
    path: 'M 20 50 Q 40 10 60 50 T 100 50 Q 120 90 140 50 T 180 50'
  },
  { 
    id: '2', 
    date: '2024-03-12', 
    distance: 8.5, 
    duration: 3120, 
    pace: '6:07', 
    calories: 680, 
    route: 'Riverside Trail',
    path: 'M 10 80 C 40 10, 60 10, 95 80 S 150 150, 190 80'
  },
  { 
    id: '3', 
    date: '2024-03-13', 
    distance: 3.1, 
    duration: 980, 
    pace: '5:16', 
    calories: 250, 
    route: 'Quick Sprint',
    path: 'M 50 50 L 150 50 L 150 150 L 50 150 Z'
  },
  { 
    id: '4', 
    date: '2024-03-14', 
    distance: 10.0, 
    duration: 3600, 
    pace: '6:00', 
    calories: 800, 
    route: 'Long Distance',
    path: 'M 20 20 C 20 20, 180 20, 180 180 C 180 180, 20 180, 20 20'
  },
];

const WEEKLY_DATA = [
  { day: 'Mon', distance: 5.2 },
  { day: 'Tue', distance: 0 },
  { day: 'Wed', distance: 8.5 },
  { day: 'Thu', distance: 3.1 },
  { day: 'Fri', distance: 10.0 },
  { day: 'Sat', distance: 0 },
  { day: 'Sun', distance: 0 },
];

const RouteMap = ({ path }: { path: string }) => (
  <div className="w-full h-32 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden relative">
    <svg viewBox="0 0 200 200" className="w-full h-full p-4">
      <motion.path
        d={path}
        fill="none"
        stroke="#10b981"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
      {/* Start Point */}
      <circle cx={path.split(' ')[1]} cy={path.split(' ')[2]} r="4" fill="#10b981" />
      {/* End Point - simplified for mock */}
      <circle cx="180" cy="50" r="4" fill="#ef4444" className="opacity-50" />
    </svg>
    <div className="absolute bottom-2 right-2 bg-white/80 backdrop-blur px-2 py-1 rounded text-[8px] font-bold text-[#9CA3AF] uppercase tracking-widest">
      Route Visualization
    </div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'activities' | 'community' | 'rooms' | 'profile'>('dashboard');
  const [isTracking, setIsTracking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showRunSummary, setShowRunSummary] = useState(false);
  const [lastRunData, setLastRunData] = useState<{ distance: number; time: number } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [gpsPath, setGpsPath] = useState<[number, number][]>([]);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  
  // User State
  const [user, setUser] = useState<{ 
    id: string; 
    name: string;
    email: string;
    unityCards: number;
    weeklyDistance: number;
    lastClaimedWeek: string;
    photoURL?: string;
    createdAt?: string;
  } | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [roomTabMode, setRoomTabMode] = useState<'main' | 'create' | 'join'>('main');
  const [roomSearchId, setRoomSearchId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState<Room | null>(null);
  const [currentView, setCurrentView] = useState<'main' | 'activity-detail' | 'weekly-stats' | 'messages' | 'chat' | 'assistant'>('main');
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [communitySearchQuery, setCommunitySearchQuery] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  
  // Messaging State
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState('');

  // Assistant State
  const [assistantMessages, setAssistantMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: "Hi! I'm your Unity Assistant. I've analyzed your running history. How can I help you improve your runs or diet today?" }
  ]);
  const [assistantInput, setAssistantInput] = useState('');
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);

  const weeklyChartData = React.useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);

    return days.map((day, index) => {
      const currentDay = new Date(start);
      currentDay.setDate(start.getDate() + index);
      
      const dayDistance = activities
        .filter(a => {
          const activityDate = new Date(a.timestamp);
          return activityDate.getDate() === currentDay.getDate() &&
                 activityDate.getMonth() === currentDay.getMonth() &&
                 activityDate.getFullYear() === currentDay.getFullYear();
        })
        .reduce((sum, a) => sum + a.distance, 0);

      return { day, distance: dayDistance };
    });
  }, [activities]);

  const currentWeeklyDistance = React.useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);

    return activities
      .filter(a => new Date(a.timestamp) >= start)
      .reduce((sum, a) => sum + a.distance, 0);
  }, [activities]);

  const personalBest = React.useMemo(() => {
    if (activities.length === 0) return 0;
    return Math.max(...activities.map(a => a.distance));
  }, [activities]);
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' | 'milestone'; data?: any } | null>(null);
  const [weeklyGoal] = useState(40);
  const [weeklyProgress, setWeeklyProgress] = useState(26.8);
  const [milestonesReached, setMilestonesReached] = useState<number[]>([]);
  const [newRoomSettings, setNewRoomSettings] = useState({
    maxParticipants: 10,
    targetDistance: 5,
    password: '',
    name: ''
  });
  const socketRef = useRef<Socket | null>(null);

  // Firebase Auth & Data Sync
  useEffect(() => {
    let unsubUser: () => void;
    let unsubActivities: () => void;
    let unsubPosts: () => void;
    let unsubChats: () => void;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        let userData: any;
        if (userSnap.exists()) {
          userData = userSnap.data();
        } else {
          // Initialize new user
          userData = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || `Runner_${nanoid(4)}`,
            email: firebaseUser.email,
            unityCards: 0,
            weeklyDistance: 0,
            lastClaimedWeek: '',
            photoURL: firebaseUser.photoURL || '',
            createdAt: new Date().toISOString(),
            goals: []
          };
          await setDoc(userRef, userData);
        }
        
        setUser({
          id: userData.uid,
          name: userData.name,
          email: userData.email,
          unityCards: userData.unityCards,
          weeklyDistance: userData.weeklyDistance,
          lastClaimedWeek: userData.lastClaimedWeek,
          photoURL: userData.photoURL || '',
          createdAt: userData.createdAt,
          goals: userData.goals || []
        });

        setEditName(userData.name);
        setEditPhotoURL(userData.photoURL || '');

        // Listen for real-time user updates
        unsubUser = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setUser(prev => prev ? {
              ...prev,
              unityCards: data.unityCards,
              weeklyDistance: data.weeklyDistance,
              lastClaimedWeek: data.lastClaimedWeek,
              photoURL: data.photoURL || '',
              createdAt: data.createdAt,
              goals: data.goals || []
            } : null);
          }
        });

        // Listen for activities
        const q = query(collection(db, 'activities'), where('uid', '==', firebaseUser.uid));
        unsubActivities = onSnapshot(q, (snapshot) => {
          const acts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setActivities(acts.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        });

        // Listen for community posts
        unsubPosts = onSnapshot(collection(db, 'posts'), (snapshot) => {
          const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCommunityPosts(posts.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        });

        // Listen for chats
        const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', firebaseUser.uid));
        unsubChats = onSnapshot(chatsQuery, async (snapshot) => {
          const chatsData = await Promise.all(snapshot.docs.map(async (chatDoc) => {
            const data = chatDoc.data();
            const otherUserId = data.participants.find((id: string) => id !== firebaseUser.uid);
            let otherUser = { name: 'Unknown User', photoURL: '' };
            if (otherUserId) {
              try {
                const otherUserSnap = await getDoc(doc(db, 'users', otherUserId));
                if (otherUserSnap.exists()) {
                  otherUser = otherUserSnap.data() as any;
                }
              } catch (e) {
                console.error("Error fetching other user", e);
              }
            }
            return { id: chatDoc.id, ...data, otherUser };
          }));
          setChats(chatsData.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
        });

        setLoading(false);
      } else {
        setUser(null);
        setLoading(false);
        if (unsubUser) unsubUser();
        if (unsubActivities) unsubActivities();
        if (unsubPosts) unsubPosts();
        if (unsubChats) unsubChats();
      }
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
      if (unsubActivities) unsubActivities();
      if (unsubPosts) unsubPosts();
      if (unsubChats) unsubChats();
    };
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
      setNotification({ message: "Failed to sign in with Google", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (socketRef.current) socketRef.current.disconnect();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Socket Connection
  useEffect(() => {
    if (!user?.id) return;
    if (socketRef.current?.connected) return;

    socketRef.current = io();
    const socket = socketRef.current;

    socket.on('available-rooms', (rooms: Room[]) => {
      setAvailableRooms(rooms);
    });

    socket.on('error', (msg: string) => {
      setNotification({ message: msg, type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    });

    socket.on('room-created', (room: Room) => {
      setCurrentRoom(room);
    });

    socket.on('room-update', (room: Room) => {
      setCurrentRoom(room);
    });

    socket.on('race-started', (room: Room) => {
      setCurrentRoom(room);
      if (room.users.some(u => u.id === user.id)) {
        setIsTracking(true);
        setElapsedTime(0);
        setCurrentDistance(0);
      }
    });

    socket.on('user-data-synced', async (data: any) => {
      // Update local state
      setUser(prev => prev ? { ...prev, ...data } : null);
      
      // Update Firestore to persist changes from server (like card claims)
      try {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          unityCards: data.unityCards,
          weeklyDistance: data.weeklyDistance,
          lastClaimedWeek: data.lastClaimedWeek
        });
      } catch (error) {
        console.error("Error persisting synced user data:", error);
      }
    });

    socket.on('success', (msg: string) => {
      setNotification({ message: msg, type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    });

    socket.emit('sync-user', user);
    socket.emit('get-rooms');

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  // Milestone Notification Logic
  useEffect(() => {
    const percentage = (weeklyProgress / weeklyGoal) * 100;
    const milestones = [25, 50, 75, 100];
    
    milestones.forEach(m => {
      if (percentage >= m && !milestonesReached.includes(m)) {
        setMilestonesReached(prev => [...prev, m]);
        const message = m === 100 ? "🎉 Weekly Goal Reached! Amazing work!" : `🔥 Milestone: ${m}% of weekly goal reached!`;
        setNotification({ 
          message, 
          type: 'milestone',
          data: { milestone: m }
        });
        setTimeout(() => setNotification(null), 8000);
      }
    });
  }, [weeklyProgress, weeklyGoal, milestonesReached]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        name: editName,
        photoURL: editPhotoURL
      });
      setIsEditingProfile(false);
      setNotification({ message: "Profile updated!", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setNotification({ message: "Failed to update profile", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const generateRandomAvatar = () => {
    const seed = nanoid(10);
    const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    setEditPhotoURL(url);
  };

  const handleShareToCommunity = async (activity: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.id,
        userName: user.name,
        userPhoto: user.photoURL || '',
        content: `Just finished a ${activity.distance.toFixed(2)}km run! 🏃‍♂️💨`,
        activityId: activity.id,
        activityData: {
          distance: activity.distance,
          duration: activity.duration,
          pace: activity.pace,
          calories: activity.calories,
          route: activity.route || "Unnamed Run",
          path: activity.path || []
        },
        timestamp: new Date().toISOString(),
        likes: []
      });
      setNotification({ message: "Shared to community!", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error sharing to community:", error);
      setNotification({ message: "Failed to share to community", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleShareAchievementToCommunity = async (runData: { distance: number, time: number }) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.id,
        userName: user.name,
        userPhoto: user.photoURL || '',
        content: `I just finished a ${runData.distance.toFixed(2)}km run in ${formatTime(runData.time)} on Runity! 🏃‍♂️💨`,
        activityData: {
          distance: runData.distance,
          duration: runData.time,
          pace: `${Math.floor(runData.time / 60 / runData.distance)}'${Math.floor((runData.time / 60 / runData.distance % 1) * 60)}"`,
          route: "Recent Run"
        },
        timestamp: new Date().toISOString(),
        likes: []
      });
      setNotification({ message: "Shared to community!", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error sharing to community:", error);
      setNotification({ message: "Failed to share to community", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleCreatePost = async (content: string) => {
    if (!user || !content.trim()) return;
    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.id,
        userName: user.name,
        userPhoto: user.photoURL || '',
        content: content.trim(),
        timestamp: new Date().toISOString(),
        likes: []
      });
      setNotification({ message: "Post created!", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error creating post:", error);
      setNotification({ message: "Failed to create post", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleLikePost = async (postId: string, likes: string[]) => {
    if (!user) return;
    try {
      const postRef = doc(db, 'posts', postId);
      if (likes.includes(user.id)) {
        await updateDoc(postRef, {
          likes: likes.filter(id => id !== user.id)
        });
      } else {
        await updateDoc(postRef, {
          likes: [...likes, user.id]
        });
      }
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  const handleStartChat = async (otherUserId: string) => {
    if (!user || user.id === otherUserId) return;
    try {
      // Check if chat already exists
      const existingChat = chats.find(c => c.participants.includes(otherUserId));
      if (existingChat) {
        setActiveChat(existingChat);
        setCurrentView('chat');
        return;
      }

      // Create new chat
      const chatRef = await addDoc(collection(db, 'chats'), {
        participants: [user.id, otherUserId],
        updatedAt: new Date().toISOString(),
        lastMessage: ''
      });
      
      const otherUserSnap = await getDoc(doc(db, 'users', otherUserId));
      const otherUser = otherUserSnap.exists() ? otherUserSnap.data() : { name: 'Unknown User', photoURL: '' };
      
      setActiveChat({ id: chatRef.id, participants: [user.id, otherUserId], otherUser });
      setCurrentView('chat');
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !activeChat || !newMessageText.trim()) return;
    try {
      const text = newMessageText.trim();
      setNewMessageText('');
      
      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        chatId: activeChat.id,
        senderId: user.id,
        text,
        timestamp: new Date().toISOString()
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: text,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  useEffect(() => {
    let unsubMessages: () => void;
    if (activeChat) {
      const q = query(collection(db, `chats/${activeChat.id}/messages`));
      unsubMessages = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setChatMessages(msgs.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      });
    }
    return () => {
      if (unsubMessages) unsubMessages();
    };
  }, [activeChat]);

  const handleAssistantMessage = async () => {
    if (!assistantInput.trim() || !user) return;
    
    const userMessage = assistantInput.trim();
    setAssistantInput('');
    setAssistantMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsAssistantTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const recentActivities = activities.slice(0, 5).map(a => 
        `Distance: ${a.distance}km, Duration: ${Math.floor(a.duration/60)}m, Pace: ${a.pace}`
      ).join('; ');

      const currentGoals = user.goals && user.goals.length > 0
        ? user.goals.map((g: any) => `ID: ${g.id}, ${g.type}: ${g.target} ${g.unit} by ${g.deadline} (Status: ${g.status})`).join('; ')
        : 'No current goals.';

      const systemInstruction = `You are Unity Assistant, an expert running coach and nutritionist. 
The user's name is ${user.name}. 
Their recent runs: ${recentActivities || 'No recent runs recorded.'}. 
Their weekly distance: ${user.weeklyDistance}km.
Their current goals: ${currentGoals}.
Provide short, encouraging, and accurate advice on running improvement, diet, and recovery based on their history.
You can help the user set new goals using the setRunningGoal tool. When setting a goal, ensure the target is realistic based on their recent runs.
You can also update the status of an existing goal using the updateRunningGoal tool by passing the goal ID.`;

      const setRunningGoalDeclaration: FunctionDeclaration = {
        name: "setRunningGoal",
        description: "Set a new running goal for the user.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              description: "The type of goal: 'distance', 'pace', or 'frequency'."
            },
            target: {
              type: Type.NUMBER,
              description: "The numerical target for the goal (e.g., 5 for 5km, 3 for 3 runs/week)."
            },
            unit: {
              type: Type.STRING,
              description: "The unit for the goal (e.g., 'km', 'min/km', 'runs/week')."
            },
            deadline: {
              type: Type.STRING,
              description: "The deadline for the goal in YYYY-MM-DD format."
            }
          },
          required: ["type", "target", "unit", "deadline"]
        }
      };

      const updateRunningGoalDeclaration: FunctionDeclaration = {
        name: "updateRunningGoal",
        description: "Update the status of an existing running goal.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            goalId: {
              type: Type.STRING,
              description: "The ID of the goal to update."
            },
            status: {
              type: Type.STRING,
              description: "The new status of the goal: 'active', 'completed', or 'abandoned'."
            }
          },
          required: ["goalId", "status"]
        }
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMessage,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [setRunningGoalDeclaration, updateRunningGoalDeclaration] }]
        }
      });

      let responseText = response.text || "I'm sorry, I couldn't process that.";

      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === 'setRunningGoal') {
          const args = call.args as any;
          const newGoal = {
            id: nanoid(),
            type: args.type,
            target: args.target,
            unit: args.unit,
            deadline: args.deadline,
            status: 'active',
            createdAt: new Date().toISOString()
          };
          
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
            goals: [...(user.goals || []), newGoal]
          });
          
          responseText = `I've set a new goal for you: ${args.target} ${args.unit} by ${args.deadline}. You've got this!`;
        } else if (call.name === 'updateRunningGoal') {
          const args = call.args as any;
          const updatedGoals = (user.goals || []).map((g: any) => 
            g.id === args.goalId ? { ...g, status: args.status } : g
          );
          
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
            goals: updatedGoals
          });
          
          responseText = `I've updated your goal status to ${args.status}. Keep up the great work!`;
        }
      }

      setAssistantMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      console.error("Assistant error:", error);
      setAssistantMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsAssistantTyping(false);
    }
  };

  const handleShare = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Runity Achievement',
          text: text,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(text);
      setNotification({ message: "Copied to clipboard!", type: 'success' });
      setTimeout(() => setNotification(null), 2000);
    }
  };
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let watchId: number;

    if (isTracking && hasStarted && !isPaused) {
      // Time tracking
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);

      // GPS tracking
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const newPos: [number, number] = [latitude, longitude];
            
            setCurrentPos(newPos);
            setGpsPath(prev => {
              if (prev.length > 0) {
                const lastPos = prev[prev.length - 1];
                const dist = getDistance(lastPos[0], lastPos[1], latitude, longitude);
                // Only add if moved significantly (e.g., > 5 meters) to reduce noise
                if (dist > 0.005) {
                  setCurrentDistance(d => {
                    const total = d + dist;
                    if (currentRoom && socketRef.current) {
                      socketRef.current.emit('update-progress', {
                        roomId: currentRoom.id,
                        userId: user?.id,
                        distance: total
                      });
                    }
                    return total;
                  });
                  return [...prev, newPos];
                }
                return prev;
              }
              return [newPos];
            });
          },
          (error) => console.error("GPS Error:", error),
          { enableHighAccuracy: true }
        );
      }
    }

    return () => {
      clearInterval(interval);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, hasStarted, isPaused, currentRoom, user]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const claimUnityCard = async () => {
    if (user) {
      // We still use socket for the logic to ensure server-side validation of time/distance
      // but the server will now update Firestore
      if (socketRef.current) {
        socketRef.current.emit('claim-unity-card', user.id);
      }
    }
  };

  const createRoom = () => {
    if (socketRef.current && user) {
      if (user.unityCards <= 0) {
        setNotification({ message: "You need a Unity Card to create a room!", type: 'error' });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      if (newRoomSettings.password.length !== 4) {
        setNotification({ message: "Password must be 4 digits", type: 'error' });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      socketRef.current.emit('create-room', {
        name: newRoomSettings.name || `${user.name}'s Race`,
        creator: user,
        maxParticipants: newRoomSettings.maxParticipants,
        targetDistance: newRoomSettings.targetDistance,
        password: newRoomSettings.password
      });
      setRoomTabMode('main');
    }
  };

  const joinRoom = (roomId: string, password?: string) => {
    if (socketRef.current && user) {
      socketRef.current.emit('join-room', { roomId, user, password });
      setJoinPassword('');
      setIsJoiningRoom(null);
    }
  };

  const startRace = () => {
    if (socketRef.current && currentRoom) {
      socketRef.current.emit('start-race', currentRoom.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center space-y-4">
          <ActivityIcon className="w-12 h-12 text-emerald-500 animate-pulse mx-auto" />
          <p className="text-sm font-bold text-[#9CA3AF] uppercase tracking-widest">Loading Runity...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-xl border border-[#E5E7EB] text-center space-y-8"
        >
          <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
            <ActivityIcon className="text-white w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter">RUNITY</h1>
            <p className="text-[#6B7280] font-medium">Connect, Compete, and Conquer your goals together.</p>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full bg-[#1A1A1A] text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-slate-200"
          >
            <Mail className="w-5 h-5" />
            Continue with Google
          </button>
          
          <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">
            Secure Authentication powered by Firebase
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB] px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <ActivityIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Runity</h1>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-100">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">{user.unityCards}</span>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">ID: {user.id.slice(0, 8)}</p>
                <p className="text-xs font-bold">{user.name}</p>
              </div>
            </div>
          )}
          <button 
            onClick={() => setActiveTab('profile')}
            className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center overflow-hidden"
          >
            <UserIcon className="w-5 h-5 text-[#4B5563]" />
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={cn(
              "fixed top-20 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-xl font-bold text-sm flex items-center gap-4",
              notification.type === 'milestone' || notification.type === 'success'
                ? "bg-emerald-500 text-white" 
                : "bg-red-500 text-white"
            )}
          >
            <span>{notification.message}</span>
            {notification.type === 'milestone' && (
              <button 
                onClick={() => handleShare(`I just reached ${notification.data.milestone}% of my weekly running goal on Runity! 🏃‍♂️💨`)}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-md mx-auto px-6 pt-6">
        <AnimatePresence mode="wait">
          {currentView === 'main' && activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Hero Section - Editorial Style */}
              <div className="relative pt-4">
                <button 
                  onClick={() => setCurrentView('assistant')}
                  className="absolute top-0 right-0 p-3 bg-emerald-500 text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform z-10"
                >
                  <Bot className="w-6 h-6" />
                </button>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-2">Current Streak: 5 Days</p>
                <h2 className="text-7xl font-black tracking-tighter leading-[0.8] mb-4">
                  KEEP<br />MOVING.
                </h2>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black">{currentWeeklyDistance.toFixed(1)}</span>
                  <span className="text-sm font-bold text-[#9CA3AF] mb-1 uppercase tracking-widest">KM THIS WEEK</span>
                </div>
              </div>

              {/* Weekly Goal Progress Bar */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E5E7EB] hover:scale-[1.02] transition-transform">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#9CA3AF]">Weekly Progress</h3>
                  <span className="text-sm font-bold text-emerald-500">{Math.round((currentWeeklyDistance / weeklyGoal) * 100)}%</span>
                </div>
                <div className="w-full bg-[#F3F4F6] h-4 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((currentWeeklyDistance / weeklyGoal) * 100, 100)}%` }}
                    className="bg-emerald-500 h-full rounded-full"
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs font-bold text-[#9CA3AF]">{currentWeeklyDistance.toFixed(1)} km</span>
                  <span className="text-xs font-bold text-[#9CA3AF]">{weeklyGoal} km goal</span>
                </div>
              </div>

              {/* Quick Action - Start Run */}
              <button 
                onClick={() => {
                  setIsTracking(true);
                  setElapsedTime(0);
                  setCurrentDistance(0);
                }}
                className="w-full bg-[#1A1A1A] text-white p-6 rounded-[2rem] flex items-center justify-between group active:scale-[0.98] transition-all"
              >
                <div className="text-left">
                  <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-1">Ready to go?</p>
                  <p className="text-xl font-bold">Start New Session</p>
                </div>
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center group-hover:rotate-45 transition-transform">
                  <Plus className="text-white w-6 h-6" />
                </div>
              </button>

              {/* Stats Grid - Bento Style */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E5E7EB] flex flex-col justify-between h-40 hover:scale-[1.02] transition-transform">
                  <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
                    <Trophy className="text-emerald-500 w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">Best Run</p>
                    <p className="text-2xl font-black mt-1">{personalBest.toFixed(1)} km</p>
                  </div>
                </div>
                <div className="bg-emerald-500 rounded-[2rem] p-6 shadow-lg shadow-emerald-100 flex flex-col justify-between h-40 text-white hover:scale-[1.02] transition-transform">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Flame className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">Calories</p>
                    <p className="text-2xl font-black mt-1">{Math.round(currentWeeklyDistance * 80)}</p>
                  </div>
                </div>
              </div>

              {/* Activity Chart */}
              <div 
                onClick={() => setCurrentView('weekly-stats')}
                className="bg-white rounded-[2rem] p-8 shadow-sm border border-[#E5E7EB] cursor-pointer hover:border-emerald-200 hover:scale-[1.02] transition-all group"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#9CA3AF] group-hover:text-emerald-500 transition-colors">Weekly Activity</h3>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-emerald-500" />)}
                  </div>
                </div>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyChartData}>
                      <defs>
                        <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="day" 
                        hide
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="stepAfter" 
                        dataKey="distance" 
                        stroke="#10b981" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorDist)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex justify-between mt-4">
                  {weeklyChartData.map(d => (
                    <div key={d.day} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">{d.day[0]}</span>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        d.distance > 0 ? "bg-emerald-500" : "bg-[#F3F4F6]"
                      )} />
                    </div>
                  ))}
                </div>

              </div>

              {/* Recent Activity */}
              <div className="space-y-4 pb-4">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#9CA3AF]">Recent Runs</h3>
                  <button onClick={() => setActiveTab('activities')}>
                    <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
                  </button>
                </div>
                <div className="space-y-3">
                  {activities.slice(0, 2).map((run) => (
                    <div 
                      key={run.id} 
                      onClick={() => {
                        setSelectedActivity(run);
                        setCurrentView('activity-detail');
                      }}
                      className="bg-white rounded-2xl p-4 flex items-center gap-4 border border-[#E5E7EB] cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-12 h-12 bg-[#F9FAFB] rounded-xl flex items-center justify-center">
                        <MapPin className="text-[#9CA3AF] w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm">{run.route || "Unnamed Run"}</h4>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{format(new Date(run.timestamp), 'MMM d')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-500">{run.distance.toFixed(1)}k</p>
                      </div>
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <p className="text-center py-4 text-[#9CA3AF] text-xs font-bold uppercase tracking-widest">No runs yet</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'main' && activeTab === 'activities' && (
            <motion.div
              key="activities"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold mb-6">Activity History</h2>
              {activities.length > 0 ? activities.map((run) => (
                <div 
                  key={run.id} 
                  onClick={() => {
                    setSelectedActivity(run);
                    setCurrentView('activity-detail');
                  }}
                  className="bg-white rounded-3xl p-5 shadow-sm border border-[#E5E7EB] flex flex-col gap-4 cursor-pointer hover:border-emerald-200 hover:scale-[1.02] transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-lg">{run.route || "Unnamed Run"}</h4>
                      <p className="text-sm text-[#6B7280]">{format(new Date(run.timestamp), 'EEEE, MMMM d')}</p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">
                      Completed
                    </div>
                  </div>
                  
                  {/* Route Map Visualization */}
                  {run.path && <RouteMap path={run.path} />}

                  <div className="grid grid-cols-3 gap-4 py-2 border-y border-[#E5E7EB]">
                    <div>
                      <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-widest">Distance</p>
                      <p className="font-bold">{run.distance.toFixed(2)} km</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-widest">Pace</p>
                      <p className="font-bold">{run.pace}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-widest">Time</p>
                      <p className="font-bold">{formatTime(run.duration)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span>{run.calories} kcal burned</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 space-y-4">
                  <History className="w-12 h-12 text-[#9CA3AF] mx-auto opacity-20" />
                  <p className="text-[#9CA3AF] font-bold uppercase tracking-widest text-xs">No activities recorded yet</p>
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'main' && activeTab === 'community' && (
            <motion.div
              key="community"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pb-24 space-y-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Community</h2>
                <button 
                  onClick={() => setCurrentView('messages')}
                  className="relative p-2 bg-[#1F2937] rounded-full text-[#9CA3AF] hover:text-white transition-colors"
                >
                  <MessageCircle className="w-6 h-6" />
                  {chats.length > 0 && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-[#111827] rounded-full"></span>
                  )}
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                <input 
                  type="text"
                  placeholder="Find runners by username..."
                  value={communitySearchQuery}
                  onChange={(e) => setCommunitySearchQuery(e.target.value)}
                  className="w-full bg-white rounded-2xl py-4 pl-12 pr-4 shadow-sm border border-[#E5E7EB] font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Create Post */}
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#E5E7EB] space-y-4">
                <textarea 
                  placeholder="Share your run or thoughts..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full bg-[#F9FAFB] rounded-2xl p-4 resize-none h-24 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <div className="flex justify-end">
                  <button 
                    onClick={() => {
                      handleCreatePost(newPostContent);
                      setNewPostContent('');
                    }}
                    disabled={!newPostContent.trim()}
                    className="bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 disabled:opacity-50 active:scale-95 transition-all"
                  >
                    Post
                  </button>
                </div>
              </div>

              {/* Feed */}
              <div className="space-y-4">
                {communityPosts
                  .filter(post => post.userName.toLowerCase().includes(communitySearchQuery.toLowerCase()))
                  .map(post => (
                  <div key={post.id} className="bg-white rounded-3xl p-5 shadow-sm border border-[#E5E7EB] space-y-4 hover:scale-[1.01] transition-transform">
                    <div className="flex items-center gap-3">
                      {post.userPhoto ? (
                        <img src={post.userPhoto} alt={post.userName} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-emerald-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold">{post.userName}</p>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                          {format(new Date(post.timestamp), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>

                    <p className="font-medium text-[#4B5563]">{post.content}</p>

                    {post.activityData && (
                      <div className="bg-[#F9FAFB] rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                          <ActivityIcon className="w-4 h-4" />
                          <span>{post.activityData.route}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Distance</p>
                            <p className="font-black">{post.activityData.distance.toFixed(2)} km</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Pace</p>
                            <p className="font-black">{post.activityData.pace}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Time</p>
                            <p className="font-black">{formatTime(post.activityData.duration)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-2 border-t border-[#E5E7EB]">
                      <button 
                        onClick={() => handleLikePost(post.id, post.likes || [])}
                        className={cn(
                          "flex items-center gap-1.5 text-sm font-bold transition-colors",
                          post.likes?.includes(user?.id) ? "text-red-500" : "text-[#9CA3AF] hover:text-red-500"
                        )}
                      >
                        <Heart className={cn("w-5 h-5", post.likes?.includes(user?.id) && "fill-current")} />
                        <span>{post.likes?.length || 0}</span>
                      </button>
                      <button className="flex items-center gap-1.5 text-sm font-bold text-[#9CA3AF] hover:text-emerald-500 transition-colors">
                        <MessageSquare className="w-5 h-5" />
                        <span>Comment</span>
                      </button>
                      {user && post.userId !== user.id && (
                        <button 
                          onClick={() => handleStartChat(post.userId)}
                          className="flex items-center gap-1.5 text-sm font-bold text-[#9CA3AF] hover:text-emerald-500 transition-colors ml-auto"
                        >
                          <MessageCircle className="w-5 h-5" />
                          <span>Message</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {communityPosts.filter(post => post.userName.toLowerCase().includes(communitySearchQuery.toLowerCase())).length === 0 && (
                  <div className="text-center py-12 space-y-4">
                    <Globe className="w-12 h-12 text-[#9CA3AF] mx-auto opacity-20" />
                    <p className="text-[#9CA3AF] font-bold uppercase tracking-widest text-xs">No posts found</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentView === 'main' && activeTab === 'rooms' && (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pb-24 space-y-6"
            >
              {/* Unity Card Claim Section */}
              {!currentRoom && roomTabMode === 'main' && user && (
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[2.5rem] p-6 text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Weekly Challenge</p>
                        <h3 className="text-2xl font-black tracking-tight">Unity Card</h3>
                      </div>
                      <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                        <Award className="w-6 h-6" />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span>Progress</span>
                          <span>{user.weeklyDistance.toFixed(1)} / 8.0 km</span>
                        </div>
                        <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((user.weeklyDistance / 8) * 100, 100)}%` }}
                            className="bg-white h-full rounded-full"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-80">
                          <Clock className="w-3 h-3" />
                          <span>Deadline: Friday 12:00 PM</span>
                        </div>
                        <button 
                          onClick={claimUnityCard}
                          disabled={user.weeklyDistance < 8}
                          className={cn(
                            "px-6 py-2 rounded-xl font-bold text-sm transition-all active:scale-95",
                            user.weeklyDistance >= 8 
                              ? "bg-white text-emerald-600 shadow-lg" 
                              : "bg-white/20 text-white/50 cursor-not-allowed"
                          )}
                        >
                          Claim Card
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Decorative background element */}
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                </div>
              )}

              {currentRoom ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setCurrentRoom(null)}
                      className="w-10 h-10 bg-white rounded-full shadow-sm border border-[#E5E7EB] flex items-center justify-center"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold">{currentRoom.name}</h2>
                      <p className="text-sm text-[#6B7280]">Room ID: {currentRoom.id} • {currentRoom.targetDistance}km Goal</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E5E7EB] space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-500" />
                        Participants ({currentRoom.users.length}/{currentRoom.maxParticipants})
                      </h3>
                      {currentRoom.status === 'waiting' && currentRoom.creator === user?.id && (
                        <button 
                          onClick={startRace}
                          className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-100"
                        >
                          <Zap className="w-4 h-4" />
                          Start Race
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {currentRoom.users.sort((a, b) => b.distance - a.distance).map((u, idx) => (
                        <div key={u.id} className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-bold">{u.name} {u.id === user?.id && "(You)"}</span>
                              <span className="text-sm font-bold text-emerald-500">{u.distance.toFixed(2)} km</span>
                            </div>
                            <div className="w-full bg-white h-2 rounded-full overflow-hidden">
                              <motion.div 
                                animate={{ width: `${Math.min((u.distance / currentRoom.targetDistance) * 100, 100)}%` }}
                                className="bg-emerald-500 h-full rounded-full"
                              />
                            </div>
                          </div>
                          {idx === 0 && u.distance > 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {currentRoom.status === 'waiting' && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3 text-emerald-700">
                      <Clock className="w-5 h-5" />
                      <p className="text-sm font-medium">Waiting for the host to start the race...</p>
                    </div>
                  )}
                </div>
              ) : roomTabMode === 'create' ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setRoomTabMode('main')}
                      className="w-10 h-10 bg-white rounded-full shadow-sm border border-[#E5E7EB] flex items-center justify-center"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-bold">Create Race Room</h2>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E5E7EB] space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest">Room Name (Optional)</label>
                      <input 
                        type="text"
                        placeholder={`${user?.name}'s Race`}
                        value={newRoomSettings.name}
                        onChange={(e) => setNewRoomSettings(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 font-bold"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest">4-Digit Password</label>
                      <input 
                        type="password"
                        maxLength={4}
                        placeholder="1234"
                        value={newRoomSettings.password}
                        onChange={(e) => setNewRoomSettings(prev => ({ ...prev, password: e.target.value.replace(/\D/g, '') }))}
                        className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 font-bold text-center text-2xl tracking-[1em]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest">Target Distance (1-60 km)</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="range" 
                          min="1" 
                          max="60" 
                          value={newRoomSettings.targetDistance}
                          onChange={(e) => setNewRoomSettings(prev => ({ ...prev, targetDistance: parseInt(e.target.value) }))}
                          className="flex-1 accent-emerald-500"
                        />
                        <span className="text-xl font-bold w-12 text-right">{newRoomSettings.targetDistance}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest">Max Participants</label>
                      <div className="grid grid-cols-5 gap-2">
                        {[2, 10, 25, 49, 99].map(num => (
                          <button
                            key={num}
                            onClick={() => setNewRoomSettings(prev => ({ ...prev, maxParticipants: num }))}
                            className={cn(
                              "py-3 rounded-xl font-bold text-sm transition-all",
                              newRoomSettings.maxParticipants === num 
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" 
                                : "bg-[#F3F4F6] text-[#6B7280]"
                            )}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={createRoom}
                      className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-100 active:scale-95 transition-transform"
                    >
                      Create Room
                    </button>
                  </div>
                </div>
              ) : roomTabMode === 'join' ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setRoomTabMode('main')}
                      className="w-10 h-10 bg-white rounded-full shadow-sm border border-[#E5E7EB] flex items-center justify-center"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-bold">Join Race Room</h2>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E5E7EB] space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest">Enter 6-Digit Room ID</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                        <input 
                          type="text"
                          maxLength={6}
                          placeholder="000000"
                          value={roomSearchId}
                          onChange={(e) => setRoomSearchId(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 pl-12 font-bold text-xl tracking-widest"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest">Available Rooms</h3>
                      {availableRooms.length > 0 ? (
                        availableRooms
                          .filter(r => !roomSearchId || r.id.includes(roomSearchId))
                          .map(room => (
                            <div key={room.id} className="bg-[#F9FAFB] rounded-2xl p-4 border border-[#E5E7EB] flex justify-between items-center">
                              <div>
                                <h4 className="font-bold">{room.name}</h4>
                                <p className="text-xs text-[#6B7280]">ID: {room.id} • {room.users.length}/{room.maxParticipants} users</p>
                              </div>
                              <button 
                                onClick={() => setIsJoiningRoom(room)}
                                className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold"
                              >
                                Join
                              </button>
                            </div>
                          ))
                      ) : (
                        <p className="text-center py-4 text-[#9CA3AF] text-sm italic">No rooms available</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 py-4">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black text-white">Unity Room</h2>
                    <p className="text-[#6B7280]">Use Unity Cards to host races or join others</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      onClick={() => setRoomTabMode('create')}
                      className="bg-white rounded-3xl p-8 shadow-sm border border-[#E5E7EB] flex flex-col items-center gap-4 group active:scale-95 transition-all"
                    >
                      <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                        <Plus className="w-8 h-8 text-emerald-600 group-hover:text-white" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold">Create Room</h3>
                        <p className="text-sm text-[#6B7280]">Start your own race and invite friends</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => setRoomTabMode('join')}
                      className="bg-white rounded-3xl p-8 shadow-sm border border-[#E5E7EB] flex flex-col items-center gap-4 group active:scale-95 transition-all"
                    >
                      <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                        <Users className="w-8 h-8 text-emerald-600 group-hover:text-white" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold">Join Room</h3>
                        <p className="text-sm text-[#6B7280]">Search by ID and enter a race</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'main' && activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center py-8">
                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-4 relative overflow-hidden group">
                  {isEditingProfile ? (
                    <div className="relative w-full h-full">
                      {editPhotoURL ? (
                        <img src={editPhotoURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserIcon className="w-12 h-12 text-emerald-600" />
                        </div>
                      )}
                      <button 
                        onClick={generateRandomAvatar}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <RefreshCw className="w-6 h-6 text-white" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon className="w-12 h-12 text-emerald-600" />
                      )}
                    </>
                  )}
                  
                  {!isEditingProfile && (
                    <button 
                      onClick={() => {
                        setIsEditingProfile(true);
                        setEditName(user?.name || '');
                        setEditPhotoURL(user?.photoURL || '');
                      }}
                      className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center border border-[#E5E7EB] active:scale-90 transition-transform"
                    >
                      <Settings className="w-4 h-4 text-[#4B5563]" />
                    </button>
                  )}
                </div>

                {isEditingProfile ? (
                  <div className="w-full max-w-xs space-y-4 flex flex-col items-center">
                    <div className="w-full">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1 block">Display Name</label>
                      <input 
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-2 font-bold focus:ring-2 focus:ring-emerald-500"
                        placeholder="Your Name"
                      />
                    </div>
                    <div className="w-full">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1 block">Photo URL (Optional)</label>
                      <input 
                        type="text"
                        value={editPhotoURL}
                        onChange={(e) => setEditPhotoURL(e.target.value)}
                        className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="https://..."
                      />
                      <button 
                        onClick={generateRandomAvatar}
                        className="text-[10px] text-emerald-600 font-bold uppercase mt-1 hover:underline"
                      >
                        Generate Random Avatar
                      </button>
                    </div>
                    <div className="flex gap-2 w-full pt-2">
                      <button 
                        onClick={() => setIsEditingProfile(false)}
                        className="flex-1 py-2 rounded-xl border border-[#E5E7EB] font-bold text-sm hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleUpdateProfile}
                        className="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 active:scale-95 transition-all"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold">{user?.name}</h2>
                    <p className="text-[#6B7280]">{user?.email}</p>
                    <div className="flex flex-col items-center mt-2">
                      <p className="text-[#9CA3AF] text-[10px] font-bold uppercase tracking-widest">Member since {user?.createdAt ? format(new Date(user.createdAt), 'MMMM yyyy') : 'Recently'}</p>
                      <p className="text-[#9CA3AF] text-[10px] font-bold uppercase tracking-widest mt-1">ID: {user?.id.slice(0, 8)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Weekly Goal Progress Bar */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E5E7EB]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#9CA3AF]">Weekly Goal</h3>
                  <span className="text-sm font-bold text-emerald-500">{Math.round((user.weeklyDistance / weeklyGoal) * 100)}%</span>
                </div>
                <div className="w-full bg-[#F3F4F6] h-3 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((user.weeklyDistance / weeklyGoal) * 100, 100)}%` }}
                    className="bg-emerald-500 h-full rounded-full"
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs font-bold text-[#9CA3AF]">{user.weeklyDistance.toFixed(1)} / {weeklyGoal} km</span>
                  <Award className={cn("w-4 h-4", user.weeklyDistance >= weeklyGoal ? "text-emerald-500" : "text-[#6B7280]")} />
                </div>
              </div>

              {/* My Goals Section */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E5E7EB] space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg">My Goals</h3>
                  <button 
                    onClick={() => setCurrentView('assistant')}
                    className="text-xs font-bold text-emerald-500 uppercase tracking-widest hover:underline"
                  >
                    Ask Assistant to Set
                  </button>
                </div>
                {user.goals && user.goals.length > 0 ? (
                  <div className="space-y-4">
                    {user.goals.map((goal: any) => (
                      <div key={goal.id} className="flex justify-between items-center p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <TrendingUp className="text-emerald-600 w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold capitalize">{goal.type} Goal</p>
                            <p className="text-xs text-[#6B7280]">Target: {goal.target} {goal.unit}</p>
                            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-widest mt-1">By {goal.deadline}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                            goal.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {goal.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-[#9CA3AF]">No goals set yet.</p>
                    <p className="text-xs text-[#9CA3AF] mt-1">Chat with the Unity Assistant to set personalized goals!</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E5E7EB] space-y-4">
                <h3 className="font-bold text-lg">Personal Bests</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
                        <Award className="text-yellow-600 w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Fastest 5k</p>
                        <p className="text-xs text-[#6B7280]">Coming Soon</p>
                      </div>
                    </div>
                    <p className="font-bold">--:--</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                        <Award className="text-purple-600 w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Longest Run</p>
                        <p className="text-xs text-[#6B7280]">
                          {activities.length > 0 ? format(new Date(activities.reduce((max, a) => a.distance > max.distance ? a : max, activities[0]).timestamp), 'MMM d, yyyy') : '--'}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold">{activities.length > 0 ? Math.max(...activities.map(a => a.distance)).toFixed(1) : '0.0'} km</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="w-full bg-white border border-[#E5E7EB] text-[#EF4444] font-bold py-4 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </button>
            </motion.div>
          )}

          {currentView === 'activity-detail' && selectedActivity && (
            <motion.div
              key="activity-detail"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setCurrentView('main')} className="w-10 h-10 bg-white rounded-xl shadow-sm border border-[#E5E7EB] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold">Activity Detail</h2>
              </div>

              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-[#E5E7EB] space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black">{selectedActivity.route || "Unnamed Run"}</h3>
                    <p className="text-[#6B7280] font-medium">{format(new Date(selectedActivity.timestamp), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                  <div className="bg-emerald-100 text-emerald-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                    Completed
                  </div>
                </div>

                <div className="h-64 bg-[#F9FAFB] rounded-3xl overflow-hidden border border-[#E5E7EB]">
                  {selectedActivity.path && <RouteMap path={selectedActivity.path} />}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#F9FAFB] rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Distance</p>
                    <p className="text-2xl font-black">{selectedActivity.distance.toFixed(2)} <span className="text-sm font-normal">km</span></p>
                  </div>
                  <div className="bg-[#F9FAFB] rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Duration</p>
                    <p className="text-2xl font-black">{formatTime(selectedActivity.duration)}</p>
                  </div>
                  <div className="bg-[#F9FAFB] rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Avg Pace</p>
                    <p className="text-2xl font-black">{selectedActivity.pace}</p>
                  </div>
                  <div className="bg-[#F9FAFB] rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Calories</p>
                    <p className="text-2xl font-black">{selectedActivity.calories} <span className="text-sm font-normal">kcal</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleShareToCommunity(selectedActivity)}
                    className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-transform"
                  >
                    <Globe className="w-5 h-5" />
                    Community
                  </button>
                  <button 
                    onClick={() => handleShare(`Check out my ${selectedActivity.distance.toFixed(2)}km run on Runity! 🏃‍♂️💨`)}
                    className="w-full bg-white text-emerald-500 border-2 border-emerald-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Share2 className="w-5 h-5" />
                    Share
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'messages' && (
            <motion.div
              key="messages"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pb-24"
            >
              <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setCurrentView('main')} className="w-10 h-10 bg-[#1F2937] rounded-xl flex items-center justify-center text-white hover:bg-[#374151] transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold">Messages</h2>
              </div>

              <div className="space-y-4">
                {chats.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <MessageCircle className="w-12 h-12 text-[#9CA3AF] mx-auto opacity-20" />
                    <p className="text-[#9CA3AF] font-bold uppercase tracking-widest text-xs">No messages yet</p>
                  </div>
                ) : (
                  chats.map(chat => (
                    <button
                      key={chat.id}
                      onClick={() => {
                        setActiveChat(chat);
                        setCurrentView('chat');
                      }}
                      className="w-full flex items-center gap-4 p-4 bg-[#1F2937] rounded-2xl hover:bg-[#374151] transition-colors text-left"
                    >
                      <img src={chat.otherUser.photoURL || `https://ui-avatars.com/api/?name=${chat.otherUser.name}`} alt={chat.otherUser.name} className="w-12 h-12 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{chat.otherUser.name}</h3>
                        <p className="text-sm text-[#9CA3AF] truncate">{chat.lastMessage || 'Started a chat'}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {currentView === 'chat' && activeChat && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-[calc(100vh-8rem)]"
            >
              <div className="flex items-center gap-4 mb-6 shrink-0">
                <button onClick={() => setCurrentView('messages')} className="w-10 h-10 bg-[#1F2937] rounded-xl flex items-center justify-center text-white hover:bg-[#374151] transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <img src={activeChat.otherUser.photoURL || `https://ui-avatars.com/api/?name=${activeChat.otherUser.name}`} alt={activeChat.otherUser.name} className="w-10 h-10 rounded-full object-cover" />
                  <h2 className="text-xl font-bold">{activeChat.otherUser.name}</h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={cn("flex", msg.senderId === user?.id ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[80%] p-4 rounded-2xl",
                      msg.senderId === user?.id ? "bg-emerald-500 text-white rounded-tr-sm" : "bg-[#1F2937] text-white rounded-tl-sm"
                    )}>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-[#1F2937] text-white rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessageText.trim()}
                  className="p-4 bg-emerald-500 text-white rounded-2xl disabled:opacity-50 hover:bg-emerald-600 transition-colors"
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}

          {currentView === 'assistant' && (
            <motion.div
              key="assistant"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-[calc(100vh-8rem)]"
            >
              <div className="flex items-center gap-4 mb-6 shrink-0">
                <button onClick={() => setCurrentView('main')} className="w-10 h-10 bg-[#1F2937] rounded-xl flex items-center justify-center text-white hover:bg-[#374151] transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <Bot className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold">Unity Assistant</h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {assistantMessages.map((msg, idx) => (
                  <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl",
                      msg.role === 'user' ? "bg-emerald-500 text-white rounded-tr-sm" : "bg-[#1F2937] text-white rounded-tl-sm"
                    )}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isAssistantTyping && (
                  <div className="flex justify-start">
                    <div className="bg-[#1F2937] text-white p-4 rounded-2xl rounded-tl-sm flex gap-1">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAssistantMessage()}
                  placeholder="Ask for advice..."
                  className="flex-1 bg-[#1F2937] text-white rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleAssistantMessage}
                  disabled={!assistantInput.trim() || isAssistantTyping}
                  className="p-4 bg-emerald-500 text-white rounded-2xl disabled:opacity-50 hover:bg-emerald-600 transition-colors"
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}

          {currentView === 'weekly-stats' && (
            <motion.div
              key="weekly-stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setCurrentView('main')} className="w-10 h-10 bg-white rounded-xl shadow-sm border border-[#E5E7EB] flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold">Weekly Performance</h2>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-[#E5E7EB] space-y-8">
                <div className="text-center space-y-2">
                  <p className="text-sm font-bold text-[#9CA3AF] uppercase tracking-widest">Total Distance This Week</p>
                  <h3 className="text-6xl font-black text-emerald-500">{currentWeeklyDistance.toFixed(1)} <span className="text-2xl font-normal text-white">km</span></h3>
                  <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold bg-emerald-50 w-fit mx-auto px-4 py-1 rounded-full text-xs">
                    <TrendingUp className="w-3 h-3" />
                    <span>+12% from last week</span>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyChartData}>
                      <defs>
                        <linearGradient id="colorDistBig" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis 
                        dataKey="day" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9CA3AF' }}
                        dy={10}
                      />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="distance" 
                        stroke="#10b981" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorDistBig)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-black">{activities.filter(a => new Date(a.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}</p>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Runs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black">{Math.round(currentWeeklyDistance * 80)}</p>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Calories</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black">{(currentWeeklyDistance / (activities.filter(a => new Date(a.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length || 1)).toFixed(1)}</p>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Avg km</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-[#E5E7EB] space-y-4">
                <h3 className="font-bold text-lg px-2">Daily Breakdown</h3>
                <div className="space-y-3">
                  {weeklyChartData.map((day) => (
                    <div key={day.day} className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                          day.distance > 0 ? "bg-emerald-100 text-emerald-600" : "bg-white text-[#9CA3AF]"
                        )}>
                          {day.day[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{day.day}</p>
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                            {day.distance > 0 ? 'Activity recorded' : 'Rest day'}
                          </p>
                        </div>
                      </div>
                      <p className="font-black text-emerald-500">{day.distance.toFixed(1)} km</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Password Prompt Modal */}
      <AnimatePresence>
        {isJoiningRoom && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                  <Lock className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Enter Room Password</h3>
                  <p className="text-sm text-[#6B7280]">Room: {isJoiningRoom.name}</p>
                </div>
                <input 
                  type="password"
                  maxLength={4}
                  autoFocus
                  placeholder="••••"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 text-center text-3xl tracking-[0.5em] font-black"
                />
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => {
                      setIsJoiningRoom(null);
                      setJoinPassword('');
                    }}
                    className="flex-1 py-4 rounded-2xl font-bold text-[#6B7280] bg-[#F3F4F6]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => joinRoom(isJoiningRoom.id, joinPassword)}
                    className="flex-1 py-4 rounded-2xl font-bold text-white bg-emerald-500 shadow-lg shadow-emerald-100"
                  >
                    Enter
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tracking Modal Overlay */}
      <AnimatePresence>
        {isTracking && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-50 bg-white flex flex-col"
          >
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-12">
              <div className="text-center">
                <p className="text-sm text-[#6B7280] font-bold uppercase tracking-widest mb-2">Duration {currentRoom && `(Race: ${currentRoom.name})`}</p>
                <h2 className="text-7xl font-black font-mono tracking-tighter">{formatTime(elapsedTime)}</h2>
              </div>

              <div className="grid grid-cols-2 w-full gap-8">
                <div className="text-center">
                  <p className="text-sm text-[#6B7280] font-bold uppercase tracking-widest mb-1">Distance</p>
                  <p className="text-4xl font-bold">{currentDistance.toFixed(2)} <span className="text-lg font-normal">km</span></p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#6B7280] font-bold uppercase tracking-widest mb-1">Pace</p>
                  <p className="text-4xl font-bold">5'45"</p>
                </div>
              </div>

              {/* Race Leaderboard in Tracking Mode */}
              {currentRoom && (
                <div className="w-full bg-[#F9FAFB] rounded-3xl p-6 border border-[#E5E7EB] space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#6B7280] flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    Live Leaderboard
                  </h3>
                  <div className="space-y-3">
                    {currentRoom.users.sort((a, b) => b.distance - a.distance).slice(0, 3).map((u, idx) => (
                      <div key={u.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#9CA3AF]">{idx + 1}.</span>
                          <span className="text-sm font-bold">{u.name} {u.id === user?.id && "(You)"}</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-500">{u.distance.toFixed(2)} km</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Map Visualization */}
              <div className="w-full h-80 bg-[#F9FAFB] rounded-3xl overflow-hidden border border-[#E5E7EB] relative z-10">
                {currentPos ? (
                  <MapContainer 
                    center={currentPos} 
                    zoom={16} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Polyline positions={gpsPath} color="#10b981" weight={5} />
                    <Marker position={currentPos} />
                    <MapUpdater center={currentPos} />
                  </MapContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF]">
                    <MapPin className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                    <p className="text-sm font-medium">Locating GPS...</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 pb-12 flex justify-center gap-6">
              {!hasStarted ? (
                <button 
                  onClick={() => {
                    if ("geolocation" in navigator) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          setHasStarted(true);
                          setIsPaused(false);
                          setCurrentPos([position.coords.latitude, position.coords.longitude]);
                        },
                        (error) => {
                          console.error("GPS Error:", error);
                          alert("GPS is required to start tracking. Please enable location services.");
                        },
                        { enableHighAccuracy: true, timeout: 10000 }
                      );
                    } else {
                      alert("Geolocation is not supported by your browser.");
                    }
                  }}
                  className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 active:scale-95 transition-transform"
                >
                  <span className="text-white font-black text-2xl tracking-widest uppercase">Start</span>
                </button>
              ) : (
                <>
                  <button 
                    onClick={async () => {
                      const runData = { distance: currentDistance, time: elapsedTime };
                      setLastRunData(runData);
                      setIsTracking(false);
                      setHasStarted(false);
                      setIsPaused(false);
                      setShowRunSummary(true);
                      
                      // Save to Firestore
                      if (user) {
                        try {
                          await addDoc(collection(db, 'activities'), {
                            uid: user.id,
                            distance: currentDistance,
                            duration: elapsedTime,
                            pace: "5'45\"", // Simplified for now
                            calories: Math.round(currentDistance * 80),
                            timestamp: new Date().toISOString(),
                            path: gpsPath.length > 0 ? `M ${gpsPath.map(p => `${p[0]} ${p[1]}`).join(' L ')}` : ''
                          });
                          
                          // Update user weekly distance in Firestore
                          const userRef = doc(db, 'users', user.id);
                          await updateDoc(userRef, {
                            weeklyDistance: user.weeklyDistance + currentDistance,
                            totalDistance: (user as any).totalDistance ? (user as any).totalDistance + currentDistance : currentDistance
                          });
                        } catch (error) {
                          console.error("Error saving run:", error);
                        }
                      }

                      if (currentRoom) setCurrentRoom(null);
                    }}
                    className="w-20 h-20 bg-[#F3F4F6] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                  >
                    <Square className="w-8 h-8 text-[#1A1A1A] fill-current" />
                  </button>
                  
                  <button 
                    onClick={() => setIsPaused(!isPaused)}
                    className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 active:scale-95 transition-transform"
                  >
                    {isPaused ? (
                      <Play className="w-8 h-8 text-white fill-current" />
                    ) : (
                      <Pause className="w-8 h-8 text-white fill-current" />
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Run Summary Modal */}
      <AnimatePresence>
        {showRunSummary && lastRunData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-8 text-center"
            >
              <div className="space-y-2">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="text-emerald-500 w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black tracking-tight">RUN COMPLETE!</h2>
                <p className="text-[#9CA3AF] font-bold uppercase tracking-widest text-xs">Great session, {user?.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F9FAFB] rounded-3xl p-4">
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Distance</p>
                  <p className="text-2xl font-black text-emerald-500">{lastRunData.distance.toFixed(2)}k</p>
                </div>
                <div className="bg-[#F9FAFB] rounded-3xl p-4">
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Time</p>
                  <p className="text-2xl font-black">{formatTime(lastRunData.time)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleShareAchievementToCommunity(lastRunData)}
                    className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-transform"
                  >
                    <Globe className="w-5 h-5" />
                    Community
                  </button>
                  <button 
                    onClick={() => handleShare(`I just finished a ${lastRunData.distance.toFixed(2)}km run in ${formatTime(lastRunData.time)} on Runity! 🏃‍♂️💨`)}
                    className="w-full bg-white text-emerald-500 border-2 border-emerald-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Share2 className="w-5 h-5" />
                    Share
                  </button>
                </div>
                <button 
                  onClick={() => setShowRunSummary(false)}
                  className="w-full bg-[#F3F4F6] text-white py-4 rounded-2xl font-bold active:scale-95 transition-transform"
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      {!isTracking && (
        <button 
          onClick={() => {
            setIsTracking(true);
            setHasStarted(false);
            setIsPaused(false);
            setElapsedTime(0);
            setCurrentDistance(0);
            setGpsPath([]);
          }}
          className="fixed bottom-24 right-6 w-16 h-16 bg-emerald-500 rounded-full shadow-xl shadow-emerald-200 flex items-center justify-center z-30 active:scale-90 transition-transform"
        >
          <Plus className="text-white w-8 h-8" />
        </button>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-[#E5E7EB] px-8 py-4 flex justify-between items-center z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'dashboard' ? "text-emerald-500" : "text-[#9CA3AF]"
          )}
        >
          <ActivityIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('activities')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'activities' ? "text-emerald-500" : "text-[#9CA3AF]"
          )}
        >
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">History</span>
        </button>
        <button 
          onClick={() => setActiveTab('community')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'community' ? "text-emerald-500" : "text-[#9CA3AF]"
          )}
        >
          <Globe className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Community</span>
        </button>
        <button 
          onClick={() => setActiveTab('rooms')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'rooms' ? "text-emerald-500" : "text-[#9CA3AF]"
          )}
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Rooms</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'profile' ? "text-emerald-500" : "text-[#9CA3AF]"
          )}
        >
          {user?.photoURL ? (
            <div className={cn(
              "w-6 h-6 rounded-full overflow-hidden border-2",
              activeTab === 'profile' ? "border-emerald-500" : "border-transparent"
            )}>
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <UserIcon className="w-6 h-6" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
        </button>
      </nav>
    </div>
  );
}
