import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import Svg, { Circle, Rect, Path, Defs, LinearGradient, Stop, G, Ellipse, Polygon } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GAME_WIDTH = Math.min(SCREEN_WIDTH, 450);
const GAME_HEIGHT = SCREEN_HEIGHT - 200;
const MAP_WIDTH = GAME_WIDTH;
const MAP_HEIGHT = GAME_HEIGHT - 50;
const TILE_SIZE = 36;
const PLAYER_SIZE = 40;
const BULLET_SIZE = 8;
const BULLET_SPEED = 12;
const PLAYER_SPEED = 4.5;
const BOT_SPEED = 2.2;
const MAX_HEALTH = 5000;
const SHELLY_DAMAGE = 460;
const ATTACK_COOLDOWN = 700;

interface Bullet { id: string; x: number; y: number; dx: number; dy: number; ownerId: string; }
interface Character { id: string; x: number; y: number; health: number; maxHealth: number; color: string; name: string; lastAttack: number; powerCubes: number; }
interface GameState {
  player: Character;
  bots: Character[];
  bullets: Bullet[];
  poisonRadius: number;
  gameStatus: 'welcome' | 'menu' | 'loading' | 'playing' | 'won' | 'lost';
  aliveCount: number;
  matchTime: number;
  playerName: string;
  trophies: number;
}

// Joystick Component
const Joystick3D = ({ type, onMove, onRelease }: { type: 'move' | 'attack'; onMove: (dx: number, dy: number) => void; onRelease: () => void }) => {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const size = type === 'move' ? 110 : 100;
  const knobSize = 55;
  const maxDist = (size - knobSize) / 2;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setActive(true),
      onPanResponderMove: (_, g) => {
        const dist = Math.min(Math.sqrt(g.dx ** 2 + g.dy ** 2), maxDist);
        const angle = Math.atan2(g.dy, g.dx);
        setKnobPos({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
        onMove(Math.cos(angle) * dist / maxDist, Math.sin(angle) * dist / maxDist);
      },
      onPanResponderRelease: () => { setKnobPos({ x: 0, y: 0 }); setActive(false); onRelease(); },
    })
  ).current;

  const baseColor = type === 'move' ? '#2196F3' : '#F44336';

  return (
    <View style={styles.joystickContainer} {...panResponder.panHandlers}>
      <View style={[styles.joystickBase3D, { width: size, height: size }]}>
        <View style={[styles.joystickBaseInner, { width: size - 8, height: size - 8, backgroundColor: `${baseColor}40`, borderColor: baseColor }]} />
      </View>
      <View style={[styles.joystickKnob3D, { width: knobSize, height: knobSize, backgroundColor: active ? `${baseColor}` : `${baseColor}cc`, transform: [{ translateX: knobPos.x }, { translateY: knobPos.y }] }]}>
        {type === 'attack' && <View style={styles.crosshair3D}><View style={styles.crosshairH} /><View style={styles.crosshairV} /><View style={styles.crosshairDot} /></View>}
      </View>
    </View>
  );
};

// EXACT Shelly Character - Like in the image
const ShellyExact = ({ x, y, scale = 1, mirrored = false }: { x: number; y: number; scale?: number; mirrored?: boolean }) => {
  const s = scale;
  const flipX = mirrored ? -1 : 1;
  
  return (
    <G transform={mirrored ? `translate(${x * 2}, 0) scale(-1, 1)` : ''}>
      {/* Shadow */}
      <Ellipse cx={x} cy={y + 85 * s} rx={25 * s} ry={8 * s} fill="rgba(0,0,0,0.3)" />
      
      {/* Shoes - Brown */}
      <Ellipse cx={x - 12 * s} cy={y + 82 * s} rx={10 * s} ry={6 * s} fill="#5D4037" />
      <Ellipse cx={x - 12 * s} cy={y + 80 * s} rx={9 * s} ry={5 * s} fill="#795548" />
      <Ellipse cx={x + 12 * s} cy={y + 82 * s} rx={10 * s} ry={6 * s} fill="#5D4037" />
      <Ellipse cx={x + 12 * s} cy={y + 80 * s} rx={9 * s} ry={5 * s} fill="#795548" />
      
      {/* Legs - Dark Blue Jeans */}
      <Rect x={x - 20 * s} y={y + 45 * s} width={16 * s} height={38 * s} rx={6} fill="#1A237E" />
      <Rect x={x - 18 * s} y={y + 47 * s} width={5 * s} height={34 * s} rx={2} fill="#283593" />
      <Rect x={x + 4 * s} y={y + 45 * s} width={16 * s} height={38 * s} rx={6} fill="#1A237E" />
      <Rect x={x + 6 * s} y={y + 47 * s} width={5 * s} height={34 * s} rx={2} fill="#283593" />
      
      {/* Body - Purple Shirt */}
      <Ellipse cx={x} cy={y + 48 * s} rx={24 * s} ry={12 * s} fill="#6A1B9A" />
      <Rect x={x - 24 * s} y={y + 10 * s} width={48 * s} height={40 * s} fill="#7B1FA2" />
      <Ellipse cx={x} cy={y + 10 * s} rx={24 * s} ry={12 * s} fill="#8E24AA" />
      
      {/* Yellow Bandana on body */}
      <Path d={`M ${x - 18 * s} ${y + 8 * s} L ${x + 18 * s} ${y + 8 * s} L ${x + 12 * s} ${y + 20 * s} L ${x - 12 * s} ${y + 20 * s} Z`} fill="#FFC107" />
      <Path d={`M ${x - 15 * s} ${y + 10 * s} L ${x + 15 * s} ${y + 10 * s} L ${x + 10 * s} ${y + 16 * s} L ${x - 10 * s} ${y + 16 * s} Z`} fill="#FFD54F" />
      
      {/* Arms - Skin */}
      <Circle cx={x - 30 * s} cy={y + 22 * s} r={12 * s} fill="#FFCC80" />
      <Circle cx={x - 30 * s} cy={y + 20 * s} r={10 * s} fill="#FFE0B2" />
      <Circle cx={x + 30 * s} cy={y + 22 * s} r={12 * s} fill="#FFCC80" />
      <Circle cx={x + 30 * s} cy={y + 20 * s} r={10 * s} fill="#FFE0B2" />
      
      {/* Shotgun */}
      <Rect x={x + 28 * s} y={y + 12 * s} width={40 * s} height={10 * s} rx={3} fill="#5D4037" />
      <Rect x={x + 30 * s} y={y + 14 * s} width={36 * s} height={4 * s} fill="#8D6E63" />
      <Rect x={x + 64 * s} y={y + 8 * s} width={12 * s} height={16 * s} rx={3} fill="#3E2723" />
      <Circle cx={x + 70 * s} cy={y + 16 * s} r={4 * s} fill="#212121" />
      
      {/* Head - Skin */}
      <Circle cx={x} cy={y - 20 * s} r={30 * s} fill="#FFCC80" />
      <Circle cx={x} cy={y - 22 * s} r={28 * s} fill="#FFE0B2" />
      <Ellipse cx={x - 8 * s} cy={y - 32 * s} rx={14 * s} ry={10 * s} fill="#FFF3E0" opacity={0.4} />
      
      {/* Hair - Pink Spiky */}
      {/* Main hair mass */}
      <Circle cx={x - 24 * s} cy={y - 50 * s} r={22 * s} fill="#C2185B" />
      <Circle cx={x + 24 * s} cy={y - 50 * s} r={22 * s} fill="#C2185B" />
      <Circle cx={x} cy={y - 58 * s} r={26 * s} fill="#D81B60" />
      
      {/* Side hair */}
      <Circle cx={x - 35 * s} cy={y - 30 * s} r={16 * s} fill="#E91E63" />
      <Circle cx={x + 35 * s} cy={y - 30 * s} r={16 * s} fill="#E91E63" />
      
      {/* Hair spikes */}
      <Circle cx={x - 15 * s} cy={y - 68 * s} r={14 * s} fill="#EC407A" />
      <Circle cx={x + 15 * s} cy={y - 66 * s} r={12 * s} fill="#EC407A" />
      <Circle cx={x - 30 * s} cy={y - 56 * s} r={10 * s} fill="#F06292" />
      <Circle cx={x + 30 * s} cy={y - 54 * s} r={9 * s} fill="#F06292" />
      <Circle cx={x} cy={y - 72 * s} r={10 * s} fill="#F48FB1" />
      
      {/* Hair highlights */}
      <Circle cx={x - 18 * s} cy={y - 62 * s} r={6 * s} fill="#F8BBD0" />
      <Circle cx={x + 8 * s} cy={y - 68 * s} r={5 * s} fill="#F8BBD0" />
      <Circle cx={x + 28 * s} cy={y - 52 * s} r={4 * s} fill="#FCE4EC" />
      
      {/* Bandana on head - Yellow */}
      <Rect x={x - 34 * s} y={y - 36 * s} width={68 * s} height={14 * s} rx={7} fill="#F9A825" />
      <Rect x={x - 32 * s} y={y - 34 * s} width={64 * s} height={6 * s} rx={3} fill="#FFC107" />
      <Rect x={x - 30 * s} y={y - 32 * s} width={60 * s} height={3 * s} rx={1} fill="#FFEB3B" />
      
      {/* Eyes */}
      <Ellipse cx={x - 12 * s} cy={y - 18 * s} rx={9 * s} ry={12 * s} fill="white" />
      <Ellipse cx={x + 12 * s} cy={y - 18 * s} rx={9 * s} ry={12 * s} fill="white" />
      <Circle cx={x - 12 * s} cy={y - 16 * s} r={6 * s} fill="#333" />
      <Circle cx={x + 12 * s} cy={y - 16 * s} r={6 * s} fill="#333" />
      <Circle cx={x - 10 * s} cy={y - 18 * s} r={3 * s} fill="white" />
      <Circle cx={x + 14 * s} cy={y - 18 * s} r={3 * s} fill="white" />
      
      {/* Eyebrows */}
      <Path d={`M ${x - 22 * s} ${y - 32 * s} Q ${x - 12 * s} ${y - 38 * s} ${x - 2 * s} ${y - 32 * s}`} stroke="#8D6E63" strokeWidth={4 * s} fill="none" />
      <Path d={`M ${x + 2 * s} ${y - 32 * s} Q ${x + 12 * s} ${y - 38 * s} ${x + 22 * s} ${y - 32 * s}`} stroke="#8D6E63" strokeWidth={4 * s} fill="none" />
      
      {/* Mouth - Confident smile */}
      <Path d={`M ${x - 10 * s} ${y - 2 * s} Q ${x} ${y + 6 * s} ${x + 10 * s} ${y - 2 * s}`} stroke="#5D4037" strokeWidth={3 * s} fill="none" />
    </G>
  );
};

// Menu Shelly with trophy
const MenuShelly = ({ x, y, trophies = 0 }: { x: number; y: number; trophies?: number }) => (
  <G>
    {/* Trophy badge above */}
    <Rect x={x - 25} y={y - 100} width={50} height={22} rx={11} fill="#1A237E" />
    <FontAwesome5 name="trophy" size={12} color="#FFC107" style={{ position: 'absolute' }} />
    <Circle cx={x - 10} cy={y - 89} r={8} fill="#FFC107" />
    <Path d={`M ${x - 14} ${y - 93} L ${x - 10} ${y - 97} L ${x - 6} ${y - 93} L ${x - 10} ${y - 85} Z`} fill="#FFD54F" />
    <Rect x={x + 2} y={y - 95} width={20} height={12} rx={2} fill="transparent" />
    
    <ShellyExact x={x} y={y} scale={0.7} />
  </G>
);

// Small avatar Shelly
const AvatarShelly = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 60 60">
    <Rect x={0} y={0} width={60} height={60} rx={12} fill="#7B1FA2" />
    <Circle cx={30} cy={35} r={18} fill="#FFE0B2" />
    <Circle cx={20} cy={12} r={14} fill="#E91E63" />
    <Circle cx={40} cy={12} r={14} fill="#E91E63" />
    <Circle cx={30} cy={8} r={16} fill="#EC407A" />
    <Rect x={8} y={22} width={44} height={8} rx={4} fill="#FFC107" />
    <Circle cx={22} cy={32} r={5} fill="white" />
    <Circle cx={38} cy={32} r={5} fill="white" />
    <Circle cx={22} cy={33} r={3} fill="#333" />
    <Circle cx={38} cy={33} r={3} fill="#333" />
    <Path d="M 24 42 Q 30 48 36 42" stroke="#5D4037" strokeWidth={2} fill="none" />
  </Svg>
);

// Bot for gameplay
const Bot3D = ({ x, y, health, maxHealth, color }: any) => {
  const hp = Math.max(0, health / maxHealth);
  return (
    <G>
      <Ellipse cx={x} cy={y + 20} rx={16} ry={6} fill="rgba(0,0,0,0.4)" />
      <Circle cx={x} cy={y} r={18} fill={color} />
      <Circle cx={x} cy={y - 2} r={14} fill="#FFE0B2" />
      <Circle cx={x - 5} cy={y - 4} r={5} fill="white" />
      <Circle cx={x + 5} cy={y - 4} r={5} fill="white" />
      <Circle cx={x - 5} cy={y - 3} r={2.5} fill="#d32f2f" />
      <Circle cx={x + 5} cy={y - 3} r={2.5} fill="#d32f2f" />
      <Path d={`M ${x - 10} ${y - 12} L ${x - 2} ${y - 8}`} stroke="#5d4037" strokeWidth={3} />
      <Path d={`M ${x + 10} ${y - 12} L ${x + 2} ${y - 8}`} stroke="#5d4037" strokeWidth={3} />
      <Rect x={x - 24} y={y - 36} width={48} height={10} rx={5} fill="#1a1a1a" />
      <Rect x={x - 22} y={y - 34} width={44 * hp} height={6} rx={3} fill="#f44336" />
    </G>
  );
};

// Player Shelly for gameplay
const PlayerShelly = ({ x, y, health, maxHealth }: any) => {
  const hp = Math.max(0, health / maxHealth);
  return (
    <G>
      <Ellipse cx={x} cy={y + 22} rx={18} ry={7} fill="rgba(0,0,0,0.35)" />
      
      {/* Simplified but recognizable Shelly for gameplay */}
      <Circle cx={x} cy={y + 5} r={16} fill="#7B1FA2" />
      <Circle cx={x} cy={y - 5} r={18} fill="#FFE0B2" />
      
      {/* Hair */}
      <Circle cx={x - 14} cy={y - 22} r={12} fill="#E91E63" />
      <Circle cx={x + 14} cy={y - 22} r={12} fill="#E91E63" />
      <Circle cx={x} cy={y - 26} r={14} fill="#EC407A" />
      
      {/* Bandana */}
      <Rect x={x - 20} y={y - 14} width={40} height={8} rx={4} fill="#FFC107" />
      
      {/* Eyes */}
      <Circle cx={x - 7} cy={y - 6} r={5} fill="white" />
      <Circle cx={x + 7} cy={y - 6} r={5} fill="white" />
      <Circle cx={x - 7} cy={y - 5} r={3} fill="#333" />
      <Circle cx={x + 7} cy={y - 5} r={3} fill="#333" />
      
      {/* Mouth */}
      <Path d={`M ${x - 6} ${y + 4} Q ${x} ${y + 8} ${x + 6} ${y + 4}`} stroke="#5D4037" strokeWidth={2} fill="none" />
      
      {/* Health bar */}
      <Rect x={x - 28} y={y - 45} width={56} height={12} rx={6} fill="#1a1a1a" />
      <Rect x={x - 26} y={y - 43} width={52 * hp} height={8} rx={4} fill={hp > 0.5 ? '#4caf50' : hp > 0.25 ? '#ff9800' : '#f44336'} />
      
      {/* Name tag */}
      <Rect x={x - 30} y={y - 60} width={60} height={14} rx={7} fill="#4caf50" />
    </G>
  );
};

// Tile for gameplay
const Tile3D = ({ x, y, type, size }: { x: number; y: number; type: string; size: number }) => {
  if (type === 'water') return <><Rect x={x} y={y} width={size} height={size} fill="#1565c0" /><Ellipse cx={x + size * 0.3} cy={y + size * 0.5} rx={8} ry={3} fill="#42a5f5" opacity={0.5} /></>;
  if (type === 'wall') return <><Rect x={x} y={y + 6} width={size} height={size - 6} fill="#3e2723" /><Rect x={x} y={y} width={size} height={size - 6} fill="#6d4c41" /><Rect x={x + 2} y={y + 2} width={size - 4} height={size - 10} fill="#8d6e63" /></>;
  if (type === 'bush') return <><Rect x={x} y={y} width={size} height={size} fill="#2e7d32" /><Circle cx={x + size / 2} cy={y + size / 2} r={size / 2 - 4} fill="#388e3c" /><Circle cx={x + size / 2 - 5} cy={y + size / 2 - 5} r={size / 3} fill="#4caf50" /></>;
  return <><Rect x={x} y={y} width={size} height={size} fill="#8d6e63" /><Rect x={x + 1} y={y + 1} width={size - 2} height={size - 2} fill="#a1887f" /></>;
};

// Main Game
export default function BrawlStars3D() {
  const [gameState, setGameState] = useState<GameState>({
    player: { id: 'player', x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, health: MAX_HEALTH, maxHealth: MAX_HEALTH, color: '#9c27b0', name: 'Spieler', lastAttack: 0, powerCubes: 0 },
    bots: [], bullets: [], poisonRadius: Math.min(MAP_WIDTH, MAP_HEIGHT) / 2,
    gameStatus: 'welcome', aliveCount: 1, matchTime: 120, playerName: '', trophies: 0,
  });

  const [nameInput, setNameInput] = useState('');
  const [loadingCountdown, setLoadingCountdown] = useState(3);
  const moveDir = useRef({ dx: 0, dy: 0 });
  const attackDir = useRef({ dx: 0, dy: 0 });
  const attacking = useRef(false);
  const loopRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const name = await AsyncStorage.getItem('brawlPlayerName');
        const trophies = await AsyncStorage.getItem('brawlTrophies');
        if (name) setGameState(p => ({ ...p, gameStatus: 'menu', playerName: name, trophies: trophies ? parseInt(trophies) : 0 }));
      } catch (e) {}
    };
    load();
  }, []);

  const saveName = async (name: string) => { try { await AsyncStorage.setItem('brawlPlayerName', name); await AsyncStorage.setItem('brawlTrophies', '0'); } catch (e) {} };
  const handleNameSubmit = () => { if (nameInput.trim().length >= 3) { const n = nameInput.trim().substring(0, 15); saveName(n); setGameState(p => ({ ...p, playerName: n, gameStatus: 'menu' })); Keyboard.dismiss(); } };

  const [mapData] = useState(() => {
    const map: string[][] = [];
    const rows = Math.floor(MAP_HEIGHT / TILE_SIZE), cols = Math.floor(MAP_WIDTH / TILE_SIZE);
    for (let y = 0; y < rows; y++) { map[y] = []; for (let x = 0; x < cols; x++) { if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) map[y][x] = 'water'; else if (Math.random() < 0.1) map[y][x] = 'wall'; else if (Math.random() < 0.18) map[y][x] = 'bush'; else map[y][x] = 'grass'; } }
    return map;
  });

  const initBots = useCallback(() => {
    const data = [{ name: 'Bull', color: '#d32f2f' }, { name: 'Colt', color: '#1976d2' }, { name: 'Nita', color: '#00897b' }, { name: 'Jessie', color: '#f57c00' }, { name: 'Brock', color: '#7b1fa2' }, { name: 'Spike', color: '#388e3c' }, { name: 'Crow', color: '#424242' }, { name: 'Poco', color: '#0097a7' }, { name: 'Primo', color: '#c62828' }];
    const bots: Character[] = [], used: { x: number; y: number }[] = [];
    for (let i = 0; i < 9; i++) { let bx, by; do { bx = 60 + Math.random() * (MAP_WIDTH - 120); by = 60 + Math.random() * (MAP_HEIGHT - 120); } while (used.some(p => Math.abs(p.x - bx) < 70 && Math.abs(p.y - by) < 70)); used.push({ x: bx, y: by }); bots.push({ id: `bot-${i}`, x: bx, y: by, health: MAX_HEALTH, maxHealth: MAX_HEALTH, color: data[i].color, name: data[i].name, lastAttack: 0, powerCubes: 0 }); }
    return bots;
  }, []);

  const startLoading = useCallback(() => { setGameState(p => ({ ...p, gameStatus: 'loading' })); setLoadingCountdown(3); const iv = setInterval(() => { setLoadingCountdown(c => { if (c <= 1) { clearInterval(iv); startGame(); return 0; } return c - 1; }); }, 1000); }, []);
  const startGame = useCallback(() => { setGameState(p => ({ ...p, player: { ...p.player, x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, health: MAX_HEALTH, lastAttack: 0 }, bots: initBots(), bullets: [], poisonRadius: Math.min(MAP_WIDTH, MAP_HEIGHT) / 2 - 30, gameStatus: 'playing', aliveCount: 10, matchTime: 120 })); timerRef.current = setInterval(() => { setGameState(p => { if (p.matchTime <= 0 || p.gameStatus !== 'playing') { if (timerRef.current) clearInterval(timerRef.current); return p; } return { ...p, matchTime: p.matchTime - 1, poisonRadius: Math.max(40, p.poisonRadius - 0.6) }; }); }, 1000); }, [initBots]);

  const shoot = useCallback((s: Character, dx: number, dy: number): Bullet[] => { const now = Date.now(); if (now - s.lastAttack < ATTACK_COOLDOWN) return []; const bullets: Bullet[] = [], base = Math.atan2(dy, dx); for (let i = 0; i < 5; i++) { const a = base + (i - 2) * 0.12; bullets.push({ id: `b-${s.id}-${now}-${i}`, x: s.x, y: s.y, dx: Math.cos(a) * BULLET_SPEED, dy: Math.sin(a) * BULLET_SPEED, ownerId: s.id }); } return bullets; }, []);
  const botAI = useCallback((bot: Character, player: Character) => { const now = Date.now(); let b = { ...bot }, newBullets: Bullet[] = []; const dist = Math.sqrt((player.x - bot.x) ** 2 + (player.y - bot.y) ** 2); let mx = 0, my = 0; if (dist > 130) { mx = (player.x - bot.x) / dist; my = (player.y - bot.y) / dist; } else if (dist < 70) { mx = -(player.x - bot.x) / dist; my = -(player.y - bot.y) / dist; } else { const a = Math.random() * Math.PI * 2; mx = Math.cos(a); my = Math.sin(a); } mx += (Math.random() - 0.5) * 0.4; my += (Math.random() - 0.5) * 0.4; const m = Math.sqrt(mx ** 2 + my ** 2); if (m > 0) { b.x += (mx / m) * BOT_SPEED; b.y += (my / m) * BOT_SPEED; } b.x = Math.max(50, Math.min(MAP_WIDTH - 50, b.x)); b.y = Math.max(50, Math.min(MAP_HEIGHT - 50, b.y)); if (dist < 160 && now - bot.lastAttack > ATTACK_COOLDOWN + Math.random() * 400) { const ax = (player.x - bot.x) / dist + (Math.random() - 0.5) * 0.2, ay = (player.y - bot.y) / dist + (Math.random() - 0.5) * 0.2, ba = Math.atan2(ay, ax); for (let i = 0; i < 3; i++) { const a = ba + (i - 1) * 0.15; newBullets.push({ id: `b-${bot.id}-${now}-${i}`, x: bot.x, y: bot.y, dx: Math.cos(a) * BULLET_SPEED * 0.75, dy: Math.sin(a) * BULLET_SPEED * 0.75, ownerId: bot.id }); } b.lastAttack = now; } return { bot: b, newBullets }; }, []);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;
    const loop = () => {
      setGameState(p => {
        if (p.gameStatus !== 'playing') return p;
        let pl = { ...p.player }; pl.x += moveDir.current.dx * PLAYER_SPEED; pl.y += moveDir.current.dy * PLAYER_SPEED; pl.x = Math.max(50, Math.min(MAP_WIDTH - 50, pl.x)); pl.y = Math.max(50, Math.min(MAP_HEIGHT - 50, pl.y));
        let bullets = [...p.bullets]; if (attacking.current && (attackDir.current.dx !== 0 || attackDir.current.dy !== 0)) { const pb = shoot(pl, attackDir.current.dx, attackDir.current.dy); if (pb.length) { bullets.push(...pb); pl.lastAttack = Date.now(); } }
        let bots = p.bots.filter(b => b.health > 0).map(bot => { const { bot: ub, newBullets } = botAI(bot, pl); bullets.push(...newBullets); return ub; });
        bullets = bullets.map(b => ({ ...b, x: b.x + b.dx, y: b.y + b.dy })).filter(b => b.x > 0 && b.x < MAP_WIDTH && b.y > 0 && b.y < MAP_HEIGHT);
        bullets = bullets.filter(b => { if (b.ownerId !== 'player') { const d = Math.sqrt((b.x - pl.x) ** 2 + (b.y - pl.y) ** 2); if (d < PLAYER_SIZE / 2 + BULLET_SIZE) { pl.health -= SHELLY_DAMAGE; return false; } } for (let i = 0; i < bots.length; i++) { if (b.ownerId !== bots[i].id) { const d = Math.sqrt((b.x - bots[i].x) ** 2 + (b.y - bots[i].y) ** 2); if (d < PLAYER_SIZE / 2 + BULLET_SIZE) { bots[i] = { ...bots[i], health: bots[i].health - SHELLY_DAMAGE }; return false; } } } return true; });
        bots = bots.filter(b => b.health > 0); const cx = MAP_WIDTH / 2, cy = MAP_HEIGHT / 2; if (Math.sqrt((pl.x - cx) ** 2 + (pl.y - cy) ** 2) > p.poisonRadius) pl.health -= 80; bots = bots.map(b => Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2) > p.poisonRadius ? { ...b, health: b.health - 80 } : b).filter(b => b.health > 0);
        let status: GameState['gameStatus'] = 'playing'; if (pl.health <= 0) { status = 'lost'; if (timerRef.current) clearInterval(timerRef.current); } else if (bots.length === 0) { status = 'won'; if (timerRef.current) clearInterval(timerRef.current); AsyncStorage.setItem('brawlTrophies', String((p.trophies || 0) + 8)); }
        return { ...p, player: pl, bots, bullets, gameStatus: status, aliveCount: 1 + bots.length, trophies: status === 'won' ? (p.trophies || 0) + 8 : p.trophies };
      });
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
    return () => { if (loopRef.current) cancelAnimationFrame(loopRef.current); };
  }, [gameState.gameStatus, shoot, botAI]);

  // ========== WELCOME ==========
  if (gameState.gameStatus === 'welcome') {
    return (
      <KeyboardAvoidingView style={styles.welcomeContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.welcomeBg} />
        <Text style={styles.logoText}>BRAWL</Text>
        <Text style={styles.logoText2}>STARS</Text>
        <Text style={styles.logoSub}>2D EDITION</Text>
        <View style={styles.welcomeShelly}><Svg width={200} height={200}><ShellyExact x={100} y={120} scale={0.65} /></Svg></View>
        <View style={styles.warningBox}><Ionicons name="warning" size={24} color="#ff1744" /><Text style={styles.warningText}>BENUTZE NICHT DEIN ECHTEN NAME!</Text></View>
        <View style={styles.nameInputContainer}><Text style={styles.nameLabel}>Gib deinen Spielernamen ein:</Text><TextInput style={styles.nameInput} placeholder="Spielername (3-15 Zeichen)" placeholderTextColor="#888" value={nameInput} onChangeText={setNameInput} maxLength={15} /></View>
        <TouchableOpacity style={[styles.submitBtn, nameInput.trim().length < 3 && styles.submitBtnDisabled]} onPress={handleNameSubmit} disabled={nameInput.trim().length < 3}><Text style={styles.submitBtnText}>SPIELEN</Text></TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  // ========== MENU - EXACT LIKE IMAGE ==========
  if (gameState.gameStatus === 'menu') {
    return (
      <View style={styles.menuContainer}>
        {/* Background - Cyan with geometric shapes */}
        <View style={styles.menuBgCyan}>
          <View style={styles.bgShape1} />
          <View style={styles.bgShape2} />
          <View style={styles.bgShape3} />
          <View style={styles.bgRay1} />
          <View style={styles.bgRay2} />
        </View>

        {/* Top Bar */}
        <View style={styles.topBar}>
          {/* Player Profile */}
          <View style={styles.profileBox}>
            <View style={styles.avatarBox}><AvatarShelly size={44} /></View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{gameState.playerName || 'Spieler'}</Text>
              <View style={styles.trophyRow}><FontAwesome5 name="trophy" size={10} color="#FFC107" /><Text style={styles.trophyCount}>{gameState.trophies}</Text></View>
            </View>
          </View>

          {/* Middle icons */}
          <View style={styles.topIcons}>
            {[0, 0, 0, 0, 0].map((_, i) => (
              <View key={i} style={styles.topIconCircle}><Text style={styles.topIconText}>0</Text></View>
            ))}
          </View>

          {/* Right side */}
          <View style={styles.topRight}>
            <View style={styles.chatBox}><Text style={styles.chatText}>CHAT</Text><Text style={styles.chatSub}>ANMELDEN</Text></View>
            <TouchableOpacity style={styles.menuIcon}><Ionicons name="menu" size={28} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Left Sidebar */}
          <View style={styles.leftSidebar}>
            <View style={styles.allGamesTab}><Text style={styles.allGamesText}>Alle Spiele</Text></View>
            <TouchableOpacity style={styles.shopBtn}><Text style={styles.shopText}>SHOP</Text></TouchableOpacity>
            <View style={styles.timerBox}><Text style={styles.timerIcon}>🏆</Text><Text style={styles.timerText}>0:00</Text><View style={styles.timerProgress}><Text style={styles.timerProgressText}>0/5</Text></View></View>
            <View style={styles.levelBox}><Text style={styles.levelNum}>1</Text><View style={styles.levelProgress}><Text style={styles.levelProgressText}>0/110</Text></View></View>
            <View style={styles.sideIcons}>
              <View style={[styles.sideIconCircle, { backgroundColor: '#4CAF50' }]} />
              <View style={[styles.sideIconCircle, { backgroundColor: '#F44336' }]}><Ionicons name="close" size={16} color="#fff" /></View>
              <TouchableOpacity style={styles.statsIcon}><Ionicons name="stats-chart" size={20} color="#fff" /></TouchableOpacity>
            </View>
          </View>

          {/* Center - Two Shellys */}
          <View style={styles.centerContent}>
            {/* Floating icons */}
            <View style={styles.floatRow}>
              <View style={styles.floatEmoji}><Text style={{ fontSize: 18 }}>😊</Text></View>
              <View style={styles.floatSkull}><Ionicons name="skull" size={16} color="#333" /></View>
              <View style={styles.floatStar}><MaterialCommunityIcons name="star" size={14} color="#FFC107" /></View>
            </View>

            {/* Trophy badges */}
            <View style={styles.trophyBadges}>
              <View style={styles.trophyBadge}><FontAwesome5 name="trophy" size={10} color="#FFC107" /><Text style={styles.badgeText}>0</Text></View>
              <View style={styles.levelBadge}><Text style={styles.levelBadgeNum}>1</Text><Text style={styles.levelBadgeSub}>50/0</Text></View>
            </View>

            {/* Two Shelly characters */}
            <View style={styles.shellysRow}>
              <Svg width={300} height={200} style={styles.shellysSvg}>
                <ShellyExact x={85} y={110} scale={0.6} />
                <ShellyExact x={215} y={110} scale={0.6} />
              </Svg>
            </View>

            {/* Clothes hanger between them */}
            <View style={styles.hangerIcon}><MaterialCommunityIcons name="hanger" size={28} color="#333" /></View>

            {/* Favorite tag */}
            <View style={styles.favoriteTag}><Ionicons name="heart" size={12} color="#E91E63" /><Text style={styles.favoriteText}>FAVORIT</Text></View>

            {/* WÄHLEN button */}
            <TouchableOpacity style={styles.chooseBtn}><Text style={styles.chooseText}>WÄHLEN</Text></TouchableOpacity>
          </View>

          {/* Right Sidebar */}
          <View style={styles.rightSidebar}>
            <TouchableOpacity style={styles.topBtn}><FontAwesome5 name="trophy" size={18} color="#2196F3" /><Text style={styles.topBtnText}>TOP</Text></TouchableOpacity>
            <TouchableOpacity style={styles.clubBtn}><Text style={styles.clubTrophies}>🏆1000</Text><Text style={styles.clubText}>CLUB</Text></TouchableOpacity>
            <View style={styles.mapMakerBox}><Text style={styles.newTag}>NEU!</Text><Text style={styles.mapMakerText}>KARTEN-</Text><Text style={styles.mapMakerText}>ERSTELLUNG</Text></View>
            <View style={styles.dailyWinsBox}><Text style={styles.dailyWinsTitle}>TÄGLICHE SIEGE!</Text><View style={styles.dailyWinsIcons}>{['#FFC107', '#4CAF50', '#F44336', '#2196F3', '#9C27B0'].map((c, i) => <View key={i} style={[styles.dailyWinIcon, { backgroundColor: c }]} />)}</View></View>
          </View>
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          {/* Starr Pass */}
          <View style={styles.starrPass}>
            <View style={styles.starrHeader}><MaterialCommunityIcons name="star-four-points" size={16} color="#4CAF50" /><Text style={styles.starrTitle}>STARR PASS</Text></View>
            <View style={styles.xpRow}><Text style={styles.xpLabel}>XP</Text><View style={styles.xpBarBg}><View style={styles.xpBarFill} /></View><Text style={styles.xpNum}>0/150</Text><View style={styles.xpBadge}><Text style={styles.xpBadgeNum}>2</Text></View></View>
            <View style={styles.starrIcons}><View style={styles.starrIcon}><AvatarShelly size={30} /></View><View style={styles.starrIcon}><AvatarShelly size={30} /></View><Text style={styles.starrCount}>50/20</Text></View>
          </View>

          {/* Mode & Play */}
          <View style={styles.modePlaySection}>
            <View style={styles.modeBox}>
              <View style={styles.modeIconRed}><Text style={styles.modeIconText}>0</Text></View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTimer}>? 6:13</Text>
                <View style={styles.modeNameRow}><Ionicons name="skull" size={16} color="#fff" /><Text style={styles.modeName}>SHOWDOWN</Text></View>
              </View>
            </View>
            <TouchableOpacity style={styles.playBtn} onPress={startLoading}><Text style={styles.playText}>SPIELEN</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ========== LOADING ==========
  if (gameState.gameStatus === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadTitle}>SHOWDOWN</Text>
        <Text style={styles.loadSub}>Jeder Brawler für sich!</Text>
        <View style={styles.playerGrid}>{[...Array(10)].map((_, i) => <View key={i} style={[styles.playerCard, { backgroundColor: ['#4caf50', '#d32f2f', '#1976d2', '#00897b', '#f57c00', '#7b1fa2', '#388e3c', '#424242', '#0097a7', '#c62828'][i] }]}><Text style={styles.cardRank}>{i + 1}</Text></View>)}</View>
        <Text style={styles.countdown}>Match startet in: {loadingCountdown}</Text>
      </View>
    );
  }

  // ========== GAME OVER ==========
  if (gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') {
    const won = gameState.gameStatus === 'won';
    return (
      <View style={[styles.gameOverBg, won ? styles.wonBg : styles.lostBg]}>
        {won ? <FontAwesome5 name="trophy" size={100} color="#ffc107" /> : <Ionicons name="skull" size={100} color="#f44336" />}
        <Text style={styles.gameOverTitle}>{won ? '#1 SIEG!' : 'BESIEGT'}</Text>
        <Text style={styles.gameOverSub}>{won ? '+8 Trophäen' : `#${gameState.aliveCount + 1} Platz`}</Text>
        <TouchableOpacity style={styles.againBtn} onPress={startLoading}><Text style={styles.againText}>NOCHMAL</Text></TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => setGameState(p => ({ ...p, gameStatus: 'menu' }))}><Text style={styles.homeText}>HAUPTMENÜ</Text></TouchableOpacity>
      </View>
    );
  }

  // ========== GAMEPLAY ==========
  return (
    <View style={styles.gameContainer}>
      <View style={styles.hud}><View style={styles.hudTimer}><Ionicons name="skull" size={20} color="#fff" /><Text style={styles.hudTimerText}>:{gameState.matchTime}</Text></View><View style={styles.hudAlive}><Text style={styles.hudAliveText}>{gameState.aliveCount}</Text><Ionicons name="people" size={18} color="#fff" /></View></View>
      <View style={styles.mapWrap}>
        <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
          {mapData.map((row, y) => row.map((tile, x) => <Tile3D key={`${x}-${y}`} x={x * TILE_SIZE} y={y * TILE_SIZE} type={tile} size={TILE_SIZE} />))}
          <Circle cx={MAP_WIDTH / 2} cy={MAP_HEIGHT / 2} r={gameState.poisonRadius} fill="none" stroke="#9c27b0" strokeWidth={5} strokeDasharray="12,6" opacity={0.7} />
          {gameState.bullets.map(b => <G key={b.id}><Circle cx={b.x} cy={b.y} r={BULLET_SIZE} fill={b.ownerId === 'player' ? '#ff9800' : '#f44336'} /></G>)}
          {gameState.bots.map(bot => <Bot3D key={bot.id} x={bot.x} y={bot.y} health={bot.health} maxHealth={bot.maxHealth} color={bot.color} />)}
          <PlayerShelly x={gameState.player.x} y={gameState.player.y} health={gameState.player.health} maxHealth={gameState.player.maxHealth} />
        </Svg>
      </View>
      <View style={styles.emotePanel}>{['😀', '😠', '😢', '👍'].map((e, i) => <TouchableOpacity key={i} style={styles.emoteBtn}><Text style={styles.emoteText}>{e}</Text></TouchableOpacity>)}</View>
      <View style={styles.controls}>
        <Joystick3D type="move" onMove={(dx, dy) => { moveDir.current = { dx, dy }; }} onRelease={() => { moveDir.current = { dx: 0, dy: 0 }; }} />
        <View style={styles.rightCtrl}><TouchableOpacity style={styles.superBtn}><MaterialCommunityIcons name="star-four-points" size={36} color="#ffc107" /></TouchableOpacity><Joystick3D type="attack" onMove={(dx, dy) => { attackDir.current = { dx, dy }; attacking.current = true; }} onRelease={() => { attackDir.current = { dx: 0, dy: 0 }; attacking.current = false; }} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Welcome
  welcomeContainer: { flex: 1, backgroundColor: '#1565c0', alignItems: 'center', justifyContent: 'center', padding: 20 },
  welcomeBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0d47a1' },
  logoText: { fontSize: 52, fontWeight: 'bold', color: '#FFC107' },
  logoText2: { fontSize: 52, fontWeight: 'bold', color: '#FF5722', marginTop: -15 },
  logoSub: { fontSize: 16, color: '#fff', letterSpacing: 4 },
  welcomeShelly: { marginVertical: 15 },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,23,68,0.2)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: '#ff1744', marginBottom: 20 },
  warningText: { color: '#ff1744', fontSize: 13, fontWeight: 'bold', marginLeft: 10 },
  nameInputContainer: { width: '100%', maxWidth: 320, marginBottom: 20 },
  nameLabel: { color: '#fff', fontSize: 15, marginBottom: 10, textAlign: 'center' },
  nameInput: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14, fontSize: 17, color: '#333', textAlign: 'center' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFC107', paddingHorizontal: 50, paddingVertical: 16, borderRadius: 30 },
  submitBtnDisabled: { backgroundColor: '#666', opacity: 0.6 },
  submitBtnText: { color: '#000', fontSize: 22, fontWeight: 'bold' },

  // Menu - EXACT like image
  menuContainer: { flex: 1, backgroundColor: '#000' },
  menuBgCyan: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00ACC1' },
  bgShape1: { position: 'absolute', bottom: '20%', left: '10%', width: 80, height: 120, backgroundColor: '#00838F', transform: [{ rotate: '15deg' }], borderRadius: 10 },
  bgShape2: { position: 'absolute', bottom: '25%', right: '15%', width: 100, height: 150, backgroundColor: '#00838F', transform: [{ rotate: '-10deg' }], borderRadius: 10 },
  bgShape3: { position: 'absolute', bottom: '15%', left: '40%', width: 60, height: 100, backgroundColor: '#00838F', transform: [{ rotate: '5deg' }], borderRadius: 10 },
  bgRay1: { position: 'absolute', top: 0, left: '30%', width: 100, height: '100%', backgroundColor: 'rgba(255,255,255,0.05)', transform: [{ skewX: '-15deg' }] },
  bgRay2: { position: 'absolute', top: 0, right: '20%', width: 80, height: '100%', backgroundColor: 'rgba(255,255,255,0.03)', transform: [{ skewX: '10deg' }] },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingTop: Platform.OS === 'ios' ? 45 : 10, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.6)' },
  profileBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A3A4A', borderRadius: 22, paddingRight: 12 },
  avatarBox: { marginLeft: -2 },
  profileInfo: { marginLeft: 6 },
  profileName: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  trophyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  trophyCount: { color: '#FFC107', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  topIcons: { flexDirection: 'row' },
  topIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1A3A4A', justifyContent: 'center', alignItems: 'center', marginHorizontal: 3 },
  topIconText: { color: '#888', fontSize: 10 },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  chatBox: { backgroundColor: '#1A3A4A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 8, alignItems: 'center' },
  chatText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  chatSub: { color: '#888', fontSize: 8 },
  menuIcon: { padding: 4 },

  mainContent: { flex: 1, flexDirection: 'row' },
  
  leftSidebar: { width: 70, alignItems: 'center', paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.4)' },
  allGamesTab: { backgroundColor: '#333', paddingVertical: 25, paddingHorizontal: 4, borderTopRightRadius: 8, borderBottomRightRadius: 8, marginBottom: 12, marginLeft: -70, paddingLeft: 70 },
  allGamesText: { color: '#fff', fontSize: 9, fontWeight: 'bold', transform: [{ rotate: '-90deg' }], width: 60 },
  shopBtn: { backgroundColor: '#4CAF50', width: 55, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  shopText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  timerBox: { backgroundColor: '#FFC107', width: 50, borderRadius: 8, padding: 5, alignItems: 'center', marginBottom: 10 },
  timerIcon: { fontSize: 12 },
  timerText: { color: '#333', fontSize: 12, fontWeight: 'bold' },
  timerProgress: { backgroundColor: '#333', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  timerProgressText: { color: '#fff', fontSize: 8 },
  levelBox: { backgroundColor: '#2196F3', width: 45, height: 45, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFC107', marginBottom: 10 },
  levelNum: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  levelProgress: { backgroundColor: '#333', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginTop: -8 },
  levelProgressText: { color: '#fff', fontSize: 7 },
  sideIcons: { marginTop: 5 },
  sideIconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginVertical: 4 },
  statsIcon: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', marginTop: 4 },

  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  floatRow: { flexDirection: 'row', position: 'absolute', top: 10, width: '80%', justifyContent: 'space-around' },
  floatEmoji: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  floatSkull: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  floatStar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  trophyBadges: { flexDirection: 'row', marginBottom: 5 },
  trophyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A237E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginHorizontal: 5 },
  badgeText: { color: '#FFC107', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  levelBadge: { backgroundColor: '#E91E63', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignItems: 'center' },
  levelBadgeNum: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  levelBadgeSub: { color: '#fff', fontSize: 8 },
  shellysRow: { marginVertical: 5 },
  shellysSvg: {},
  hangerIcon: { position: 'absolute', top: '45%', backgroundColor: '#fff', width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  favoriteTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(233,30,99,0.3)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15, marginTop: 5 },
  favoriteText: { color: '#E91E63', fontSize: 11, fontWeight: 'bold', marginLeft: 5 },
  chooseBtn: { backgroundColor: '#1A3A4A', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20, marginTop: 10, borderWidth: 2, borderColor: '#2196F3' },
  chooseText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  rightSidebar: { width: 80, alignItems: 'center', paddingTop: 10 },
  topBtn: { backgroundColor: '#1A3A4A', width: 60, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: '#2196F3' },
  topBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  clubBtn: { backgroundColor: '#4CAF50', width: 60, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  clubTrophies: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  clubText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  mapMakerBox: { backgroundColor: '#1A3A4A', borderRadius: 8, padding: 6, alignItems: 'center', marginBottom: 10 },
  newTag: { color: '#4CAF50', fontSize: 9, fontWeight: 'bold' },
  mapMakerText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  dailyWinsBox: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: 8, alignItems: 'center' },
  dailyWinsTitle: { color: '#FFC107', fontSize: 8, fontWeight: 'bold', marginBottom: 5 },
  dailyWinsIcons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dailyWinIcon: { width: 18, height: 18, borderRadius: 4, margin: 2 },

  bottomBar: { flexDirection: 'row', paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 25 : 12, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.6)' },
  starrPass: { flex: 1 },
  starrHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  starrTitle: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  xpRow: { flexDirection: 'row', alignItems: 'center' },
  xpLabel: { color: '#FFC107', fontSize: 10, fontWeight: 'bold', marginRight: 5 },
  xpBarBg: { flex: 1, height: 12, backgroundColor: '#333', borderRadius: 6 },
  xpBarFill: { width: '0%', height: '100%', backgroundColor: '#FFC107', borderRadius: 6 },
  xpNum: { color: '#fff', fontSize: 10, marginLeft: 6 },
  xpBadge: { backgroundColor: '#F44336', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginLeft: 5 },
  xpBadgeNum: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  starrIcons: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  starrIcon: { marginRight: 5 },
  starrCount: { color: '#fff', fontSize: 10, marginLeft: 5 },
  modePlaySection: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  modeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', borderRadius: 10, padding: 8, marginRight: 10 },
  modeIconRed: { width: 35, height: 35, borderRadius: 17, backgroundColor: '#F44336', justifyContent: 'center', alignItems: 'center' },
  modeIconText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  modeInfo: { marginLeft: 8 },
  modeTimer: { color: '#888', fontSize: 10 },
  modeNameRow: { flexDirection: 'row', alignItems: 'center' },
  modeName: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  playBtn: { backgroundColor: '#FFC107', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 10 },
  playText: { color: '#000', fontSize: 20, fontWeight: 'bold' },

  // Loading
  loadingContainer: { flex: 1, backgroundColor: '#1b263b', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadTitle: { color: '#f44336', fontSize: 34, fontWeight: 'bold' },
  loadSub: { color: '#fff', fontSize: 16, marginTop: 8, marginBottom: 25 },
  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  playerCard: { width: 55, height: 65, borderRadius: 10, justifyContent: 'flex-end', alignItems: 'center', margin: 5, paddingBottom: 8 },
  cardRank: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  countdown: { color: '#ffc107', fontSize: 26, fontWeight: 'bold', marginTop: 30 },

  // Game Over
  gameOverBg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wonBg: { backgroundColor: '#1b3d1b' },
  lostBg: { backgroundColor: '#3d1b1b' },
  gameOverTitle: { color: '#fff', fontSize: 38, fontWeight: 'bold', marginTop: 20 },
  gameOverSub: { color: '#aaa', fontSize: 18, marginTop: 10 },
  againBtn: { backgroundColor: '#4caf50', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 25, marginTop: 40 },
  againText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  homeBtn: { backgroundColor: '#1976d2', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 25, marginTop: 15 },
  homeText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Gameplay
  gameContainer: { flex: 1, backgroundColor: '#1b263b' },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
  hudTimer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f44336', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  hudTimerText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 6 },
  hudAlive: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  hudAliveText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 6 },
  mapWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emotePanel: { position: 'absolute', right: 12, top: '28%', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 10 },
  emoteBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', marginVertical: 3 },
  emoteText: { fontSize: 24 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, paddingBottom: Platform.OS === 'ios' ? 28 : 15, height: 155 },
  rightCtrl: { alignItems: 'center' },
  superBtn: { width: 55, height: 55, backgroundColor: '#333', borderRadius: 27, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 3, borderColor: '#ffc107' },

  joystickContainer: { alignItems: 'center', justifyContent: 'center' },
  joystickBase3D: { borderRadius: 100, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  joystickBaseInner: { borderRadius: 100, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  joystickKnob3D: { position: 'absolute', borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  crosshair3D: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  crosshairH: { position: 'absolute', width: 22, height: 4, backgroundColor: '#fff', borderRadius: 2 },
  crosshairV: { position: 'absolute', width: 4, height: 22, backgroundColor: '#fff', borderRadius: 2 },
  crosshairDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
});
