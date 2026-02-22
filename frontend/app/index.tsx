import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { 
  Circle, Rect, Path, Defs, LinearGradient, RadialGradient, Stop, G, Ellipse, Polygon,
  ClipPath, Mask, Filter, FeDropShadow, FeGaussianBlur
} from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game Constants
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

interface Bullet {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  ownerId: string;
}

interface Character {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  color: string;
  name: string;
  lastAttack: number;
  powerCubes: number;
}

interface GameState {
  player: Character;
  bots: Character[];
  bullets: Bullet[];
  poisonRadius: number;
  gameStatus: 'menu' | 'loading' | 'playing' | 'won' | 'lost';
  aliveCount: number;
  matchTime: number;
}

// 3D Isometric Joystick
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
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        setKnobPos({ x, y });
        onMove(x / maxDist, y / maxDist);
      },
      onPanResponderRelease: () => {
        setKnobPos({ x: 0, y: 0 });
        setActive(false);
        onRelease();
      },
    })
  ).current;

  const baseColor = type === 'move' ? '#2196F3' : '#F44336';
  const glowColor = type === 'move' ? '#64B5F6' : '#EF5350';

  return (
    <View style={styles.joystickContainer} {...panResponder.panHandlers}>
      {/* Outer glow ring */}
      <View style={[styles.joystickGlow, { width: size + 30, height: size + 30, backgroundColor: active ? `${glowColor}30` : 'transparent' }]} />
      {/* Base with 3D effect */}
      <View style={[styles.joystickBase3D, { width: size, height: size }]}>
        <View style={[styles.joystickBaseInner, { width: size - 8, height: size - 8, backgroundColor: `${baseColor}40`, borderColor: baseColor }]} />
      </View>
      {/* Knob with 3D gradient */}
      <View
        style={[
          styles.joystickKnob3D,
          {
            width: knobSize,
            height: knobSize,
            backgroundColor: active ? glowColor : baseColor,
            transform: [{ translateX: knobPos.x }, { translateY: knobPos.y }],
            shadowColor: baseColor,
          },
        ]}
      >
        {type === 'attack' && (
          <View style={styles.crosshair3D}>
            <View style={[styles.crosshairH, { backgroundColor: '#fff' }]} />
            <View style={[styles.crosshairV, { backgroundColor: '#fff' }]} />
            <View style={styles.crosshairDot} />
          </View>
        )}
        {/* Knob highlight */}
        <View style={styles.knobHighlight} />
      </View>
    </View>
  );
};

// 3D Shelly Character with detailed shading
const Shelly3D = ({ x, y, health, maxHealth, isPlayer, scale = 1 }: any) => {
  const hp = Math.max(0, health / maxHealth);
  const s = scale;
  
  return (
    <G>
      {/* Ground shadow */}
      <Ellipse cx={x} cy={y + 22 * s} rx={18 * s} ry={8 * s} fill="rgba(0,0,0,0.4)" />
      
      {/* Legs */}
      <Rect x={x - 12 * s} y={y + 8 * s} width={10 * s} height={16 * s} rx={4} fill="#1a237e" />
      <Rect x={x + 2 * s} y={y + 8 * s} width={10 * s} height={16 * s} rx={4} fill="#283593" />
      {/* Shoes */}
      <Ellipse cx={x - 7 * s} cy={y + 22 * s} rx={6 * s} ry={4 * s} fill="#5d4037" />
      <Ellipse cx={x + 7 * s} cy={y + 22 * s} rx={6 * s} ry={4 * s} fill="#6d4c41" />
      
      {/* Body/Shirt - 3D cylinder effect */}
      <Ellipse cx={x} cy={y + 10 * s} rx={16 * s} ry={8 * s} fill="#6a1b9a" />
      <Rect x={x - 16 * s} y={y - 8 * s} width={32 * s} height={18 * s} fill="#7b1fa2" />
      <Ellipse cx={x} cy={y - 8 * s} rx={16 * s} ry={6 * s} fill="#8e24aa" />
      {/* Shirt shading */}
      <Path d={`M ${x - 12 * s} ${y - 5 * s} Q ${x} ${y + 2 * s} ${x + 12 * s} ${y - 5 * s}`} fill="#9c27b0" opacity={0.5} />
      
      {/* Arms */}
      <Circle cx={x - 20 * s} cy={y - 2 * s} r={8 * s} fill="#ffcc80" />
      <Circle cx={x - 20 * s} cy={y - 2 * s} r={6 * s} fill="#ffe0b2" />
      <Circle cx={x + 20 * s} cy={y - 2 * s} r={8 * s} fill="#ffcc80" />
      <Circle cx={x + 20 * s} cy={y - 2 * s} r={6 * s} fill="#ffe0b2" />
      
      {/* Shotgun */}
      <Rect x={x + 18 * s} y={y - 8 * s} width={28 * s} height={6 * s} rx={2} fill="#5d4037" />
      <Rect x={x + 18 * s} y={y - 7 * s} width={28 * s} height={2 * s} fill="#8d6e63" />
      <Circle cx={x + 44 * s} cy={y - 5 * s} r={4 * s} fill="#3e2723" />
      
      {/* Head - 3D sphere effect */}
      <Circle cx={x} cy={y - 22 * s} r={20 * s} fill="#ffcc80" />
      <Circle cx={x} cy={y - 22 * s} r={18 * s} fill="#ffe0b2" />
      <Ellipse cx={x - 5 * s} cy={y - 28 * s} rx={8 * s} ry={6 * s} fill="#fff3e0" opacity={0.4} />
      
      {/* Hair - Pink spiky 3D */}
      <Circle cx={x - 16 * s} cy={y - 38 * s} r={14 * s} fill="#e91e63" />
      <Circle cx={x + 16 * s} cy={y - 38 * s} r={14 * s} fill="#e91e63" />
      <Circle cx={x} cy={y - 44 * s} r={16 * s} fill="#f06292" />
      <Circle cx={x - 22 * s} cy={y - 28 * s} r={10 * s} fill="#ec407a" />
      <Circle cx={x + 22 * s} cy={y - 28 * s} r={10 * s} fill="#ec407a" />
      {/* Hair highlights */}
      <Circle cx={x - 12 * s} cy={y - 46 * s} r={6 * s} fill="#f48fb1" />
      <Circle cx={x + 8 * s} cy={y - 48 * s} r={5 * s} fill="#f48fb1" />
      
      {/* Bandana */}
      <Rect x={x - 22 * s} y={y - 30 * s} width={44 * s} height={8 * s} rx={4} fill="#ffc107" />
      <Rect x={x - 20 * s} y={y - 29 * s} width={40 * s} height={3 * s} rx={1} fill="#ffeb3b" />
      
      {/* Eyes - 3D */}
      <Ellipse cx={x - 8 * s} cy={y - 22 * s} rx={6 * s} ry={8 * s} fill="white" />
      <Ellipse cx={x + 8 * s} cy={y - 22 * s} rx={6 * s} ry={8 * s} fill="white" />
      <Circle cx={x - 8 * s} cy={y - 20 * s} r={4 * s} fill="#333" />
      <Circle cx={x + 8 * s} cy={y - 20 * s} r={4 * s} fill="#333" />
      <Circle cx={x - 6 * s} cy={y - 22 * s} r={2 * s} fill="white" />
      <Circle cx={x + 10 * s} cy={y - 22 * s} r={2 * s} fill="white" />
      
      {/* Eyebrows */}
      <Path d={`M ${x - 14 * s} ${y - 32 * s} Q ${x - 8 * s} ${y - 36 * s} ${x - 2 * s} ${y - 32 * s}`} stroke="#8d6e63" strokeWidth={2.5 * s} fill="none" />
      <Path d={`M ${x + 2 * s} ${y - 32 * s} Q ${x + 8 * s} ${y - 36 * s} ${x + 14 * s} ${y - 32 * s}`} stroke="#8d6e63" strokeWidth={2.5 * s} fill="none" />
      
      {/* Mouth */}
      <Path d={`M ${x - 6 * s} ${y - 12 * s} Q ${x} ${y - 6 * s} ${x + 6 * s} ${y - 12 * s}`} stroke="#5d4037" strokeWidth={2 * s} fill="none" />
      
      {/* Health bar - 3D style */}
      <Rect x={x - 28 * s} y={y - 62 * s} width={56 * s} height={12 * s} rx={6} fill="#263238" />
      <Rect x={x - 26 * s} y={y - 60 * s} width={52 * s} height={8 * s} rx={4} fill="#37474f" />
      <Rect x={x - 26 * s} y={y - 60 * s} width={52 * hp * s} height={8 * s} rx={4} fill={hp > 0.5 ? '#4caf50' : hp > 0.25 ? '#ff9800' : '#f44336'} />
      <Rect x={x - 26 * s} y={y - 60 * s} width={52 * hp * s} height={3 * s} rx={2} fill={hp > 0.5 ? '#81c784' : hp > 0.25 ? '#ffb74d' : '#e57373'} />
      
      {/* Player name tag */}
      {isPlayer && (
        <G>
          <Rect x={x - 30 * s} y={y - 78 * s} width={60 * s} height={14 * s} rx={7} fill="#4caf50" />
          <Rect x={x - 28 * s} y={y - 76 * s} width={56 * s} height={10 * s} rx={5} fill="#388e3c" />
        </G>
      )}
    </G>
  );
};

// 3D Bot Character
const Bot3D = ({ x, y, health, maxHealth, color, name }: any) => {
  const hp = Math.max(0, health / maxHealth);
  const darkColor = color;
  const lightColor = `${color}cc`;
  
  return (
    <G>
      {/* Shadow */}
      <Ellipse cx={x} cy={y + 18} rx={14} ry={6} fill="rgba(0,0,0,0.4)" />
      
      {/* Body */}
      <Circle cx={x} cy={y} r={16} fill={darkColor} />
      <Circle cx={x - 3} cy={y - 3} r={14} fill={lightColor} />
      
      {/* Face */}
      <Circle cx={x} cy={y - 2} r={12} fill="#ffe0b2" />
      <Ellipse cx={x - 3} cy={y - 6} rx={6} ry={4} fill="#fff3e0" opacity={0.4} />
      
      {/* Evil eyes */}
      <Circle cx={x - 5} cy={y - 4} r={4} fill="white" />
      <Circle cx={x + 5} cy={y - 4} r={4} fill="white" />
      <Circle cx={x - 5} cy={y - 3} r={2} fill="#d32f2f" />
      <Circle cx={x + 5} cy={y - 3} r={2} fill="#d32f2f" />
      
      {/* Angry eyebrows */}
      <Path d={`M ${x - 9} ${y - 10} L ${x - 2} ${y - 7}`} stroke="#5d4037" strokeWidth={2.5} />
      <Path d={`M ${x + 9} ${y - 10} L ${x + 2} ${y - 7}`} stroke="#5d4037" strokeWidth={2.5} />
      
      {/* Health bar */}
      <Rect x={x - 22} y={y - 32} width={44} height={8} rx={4} fill="#263238" />
      <Rect x={x - 20} y={y - 30} width={40 * hp} height={4} rx={2} fill="#f44336" />
    </G>
  );
};

// 3D Map Tile
const Tile3D = ({ x, y, type, size }: { x: number; y: number; type: string; size: number }) => {
  switch (type) {
    case 'grass':
      return (
        <G>
          <Rect x={x} y={y} width={size} height={size} fill="#8d6e63" />
          <Rect x={x + 1} y={y + 1} width={size - 2} height={size - 2} fill="#a1887f" />
          {/* Grass tufts */}
          <Circle cx={x + size * 0.25} cy={y + size * 0.3} r={4} fill="#66bb6a" />
          <Circle cx={x + size * 0.7} cy={y + size * 0.6} r={5} fill="#81c784" />
          <Circle cx={x + size * 0.4} cy={y + size * 0.8} r={3} fill="#4caf50" />
          {/* Small stones */}
          <Ellipse cx={x + size * 0.8} cy={y + size * 0.2} rx={3} ry={2} fill="#9e9e9e" />
        </G>
      );
    case 'bush':
      return (
        <G>
          <Rect x={x} y={y} width={size} height={size} fill="#2e7d32" />
          {/* 3D bush layers */}
          <Circle cx={x + size / 2} cy={y + size / 2 + 4} r={size / 2 - 2} fill="#1b5e20" />
          <Circle cx={x + size / 2} cy={y + size / 2} r={size / 2 - 4} fill="#388e3c" />
          <Circle cx={x + size / 2 - 4} cy={y + size / 2 - 4} r={size / 3} fill="#4caf50" />
          <Circle cx={x + size / 2 + 6} cy={y + size / 2 - 2} r={size / 4} fill="#66bb6a" />
          {/* Highlights */}
          <Circle cx={x + size * 0.3} cy={y + size * 0.3} r={4} fill="#81c784" />
        </G>
      );
    case 'wall':
      return (
        <G>
          {/* 3D wall with depth */}
          <Rect x={x} y={y + 6} width={size} height={size - 6} fill="#4e342e" />
          <Rect x={x} y={y} width={size} height={size - 6} fill="#6d4c41" />
          <Rect x={x + 2} y={y + 2} width={size - 4} height={size - 10} fill="#8d6e63" />
          {/* Brick pattern */}
          <Rect x={x + 3} y={y + 4} width={size / 2 - 4} height={size / 3 - 2} fill="#795548" rx={2} />
          <Rect x={x + size / 2 + 1} y={y + 4} width={size / 2 - 4} height={size / 3 - 2} fill="#795548" rx={2} />
          <Rect x={x + size / 4} y={y + size / 3 + 3} width={size / 2} height={size / 3 - 2} fill="#795548" rx={2} />
          {/* Highlight */}
          <Rect x={x + 3} y={y + 3} width={size - 6} height={2} fill="#a1887f" />
        </G>
      );
    case 'water':
      return (
        <G>
          <Rect x={x} y={y} width={size} height={size} fill="#1565c0" />
          <Rect x={x + 2} y={y + 2} width={size - 4} height={size - 4} fill="#1976d2" />
          {/* Water ripples */}
          <Ellipse cx={x + size * 0.3} cy={y + size * 0.5} rx={8} ry={3} fill="#42a5f5" opacity={0.6} />
          <Ellipse cx={x + size * 0.7} cy={y + size * 0.3} rx={6} ry={2} fill="#64b5f6" opacity={0.5} />
          <Ellipse cx={x + size * 0.5} cy={y + size * 0.8} rx={5} ry={2} fill="#90caf9" opacity={0.4} />
        </G>
      );
    default:
      return <Rect x={x} y={y} width={size} height={size} fill="#a1887f" />;
  }
};

// 3D Bullet
const Bullet3D = ({ x, y, isPlayer }: { x: number; y: number; isPlayer: boolean }) => (
  <G>
    <Ellipse cx={x} cy={y + 3} rx={6} ry={3} fill="rgba(0,0,0,0.3)" />
    <Circle cx={x} cy={y} r={BULLET_SIZE} fill={isPlayer ? '#ff9800' : '#f44336'} />
    <Circle cx={x} cy={y} r={BULLET_SIZE - 2} fill={isPlayer ? '#ffb74d' : '#e57373'} />
    <Circle cx={x - 2} cy={y - 2} r={3} fill={isPlayer ? '#ffe082' : '#ffcdd2'} />
  </G>
);

// Main Game Component
export default function BrawlStars3D() {
  const [gameState, setGameState] = useState<GameState>({
    player: { id: 'player', x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, health: MAX_HEALTH, maxHealth: MAX_HEALTH, color: '#9c27b0', name: 'Player', lastAttack: 0, powerCubes: 0 },
    bots: [],
    bullets: [],
    poisonRadius: Math.min(MAP_WIDTH, MAP_HEIGHT) / 2,
    gameStatus: 'menu',
    aliveCount: 1,
    matchTime: 120,
  });

  const [loadingCountdown, setLoadingCountdown] = useState(3);
  const moveDir = useRef({ dx: 0, dy: 0 });
  const attackDir = useRef({ dx: 0, dy: 0 });
  const attacking = useRef(false);
  const loopRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate detailed map
  const [mapData] = useState(() => {
    const map: string[][] = [];
    const rows = Math.floor(MAP_HEIGHT / TILE_SIZE);
    const cols = Math.floor(MAP_WIDTH / TILE_SIZE);
    for (let y = 0; y < rows; y++) {
      map[y] = [];
      for (let x = 0; x < cols; x++) {
        if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) map[y][x] = 'water';
        else if (Math.random() < 0.1) map[y][x] = 'wall';
        else if (Math.random() < 0.18) map[y][x] = 'bush';
        else map[y][x] = 'grass';
      }
    }
    return map;
  });

  const initBots = useCallback(() => {
    const botData = [
      { name: 'Bull', color: '#d32f2f' },
      { name: 'Colt', color: '#1976d2' },
      { name: 'Nita', color: '#00897b' },
      { name: 'Jessie', color: '#f57c00' },
      { name: 'Brock', color: '#7b1fa2' },
      { name: 'Spike', color: '#388e3c' },
      { name: 'Crow', color: '#424242' },
      { name: 'Poco', color: '#0097a7' },
      { name: 'Primo', color: '#c62828' },
    ];
    const bots: Character[] = [];
    const used: { x: number; y: number }[] = [];
    for (let i = 0; i < 9; i++) {
      let bx, by;
      do {
        bx = 60 + Math.random() * (MAP_WIDTH - 120);
        by = 60 + Math.random() * (MAP_HEIGHT - 120);
      } while (used.some(p => Math.abs(p.x - bx) < 70 && Math.abs(p.y - by) < 70));
      used.push({ x: bx, y: by });
      bots.push({ id: `bot-${i}`, x: bx, y: by, health: MAX_HEALTH, maxHealth: MAX_HEALTH, color: botData[i].color, name: botData[i].name, lastAttack: 0, powerCubes: 0 });
    }
    return bots;
  }, []);

  const startLoading = useCallback(() => {
    setGameState(p => ({ ...p, gameStatus: 'loading' }));
    setLoadingCountdown(3);
    const iv = setInterval(() => {
      setLoadingCountdown(c => {
        if (c <= 1) { clearInterval(iv); startGame(); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  const startGame = useCallback(() => {
    setGameState({
      player: { id: 'player', x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, health: MAX_HEALTH, maxHealth: MAX_HEALTH, color: '#9c27b0', name: 'Player', lastAttack: 0, powerCubes: 0 },
      bots: initBots(),
      bullets: [],
      poisonRadius: Math.min(MAP_WIDTH, MAP_HEIGHT) / 2 - 30,
      gameStatus: 'playing',
      aliveCount: 10,
      matchTime: 120,
    });
    timerRef.current = setInterval(() => {
      setGameState(p => {
        if (p.matchTime <= 0 || p.gameStatus !== 'playing') { if (timerRef.current) clearInterval(timerRef.current); return p; }
        return { ...p, matchTime: p.matchTime - 1, poisonRadius: Math.max(40, p.poisonRadius - 0.6) };
      });
    }, 1000);
  }, [initBots]);

  const shoot = useCallback((s: Character, dx: number, dy: number): Bullet[] => {
    const now = Date.now();
    if (now - s.lastAttack < ATTACK_COOLDOWN) return [];
    const bullets: Bullet[] = [];
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < 5; i++) {
      const a = base + (i - 2) * 0.12;
      bullets.push({ id: `b-${s.id}-${now}-${i}`, x: s.x, y: s.y, dx: Math.cos(a) * BULLET_SPEED, dy: Math.sin(a) * BULLET_SPEED, ownerId: s.id });
    }
    return bullets;
  }, []);

  const botAI = useCallback((bot: Character, player: Character) => {
    const now = Date.now();
    let b = { ...bot };
    let newBullets: Bullet[] = [];
    const dist = Math.sqrt((player.x - bot.x) ** 2 + (player.y - bot.y) ** 2);
    let mx = 0, my = 0;
    if (dist > 130) { mx = (player.x - bot.x) / dist; my = (player.y - bot.y) / dist; }
    else if (dist < 70) { mx = -(player.x - bot.x) / dist; my = -(player.y - bot.y) / dist; }
    else { const a = Math.random() * Math.PI * 2; mx = Math.cos(a); my = Math.sin(a); }
    mx += (Math.random() - 0.5) * 0.4;
    my += (Math.random() - 0.5) * 0.4;
    const m = Math.sqrt(mx ** 2 + my ** 2);
    if (m > 0) { b.x += (mx / m) * BOT_SPEED; b.y += (my / m) * BOT_SPEED; }
    b.x = Math.max(50, Math.min(MAP_WIDTH - 50, b.x));
    b.y = Math.max(50, Math.min(MAP_HEIGHT - 50, b.y));
    if (dist < 160 && now - bot.lastAttack > ATTACK_COOLDOWN + Math.random() * 400) {
      const ax = (player.x - bot.x) / dist + (Math.random() - 0.5) * 0.2;
      const ay = (player.y - bot.y) / dist + (Math.random() - 0.5) * 0.2;
      const ba = Math.atan2(ay, ax);
      for (let i = 0; i < 3; i++) {
        const a = ba + (i - 1) * 0.15;
        newBullets.push({ id: `b-${bot.id}-${now}-${i}`, x: bot.x, y: bot.y, dx: Math.cos(a) * BULLET_SPEED * 0.75, dy: Math.sin(a) * BULLET_SPEED * 0.75, ownerId: bot.id });
      }
      b.lastAttack = now;
    }
    return { bot: b, newBullets };
  }, []);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;
    const loop = () => {
      setGameState(p => {
        if (p.gameStatus !== 'playing') return p;
        const now = Date.now();
        let pl = { ...p.player };
        pl.x += moveDir.current.dx * PLAYER_SPEED;
        pl.y += moveDir.current.dy * PLAYER_SPEED;
        pl.x = Math.max(50, Math.min(MAP_WIDTH - 50, pl.x));
        pl.y = Math.max(50, Math.min(MAP_HEIGHT - 50, pl.y));
        let bullets = [...p.bullets];
        if (attacking.current && (attackDir.current.dx !== 0 || attackDir.current.dy !== 0)) {
          const pb = shoot(pl, attackDir.current.dx, attackDir.current.dy);
          if (pb.length) { bullets.push(...pb); pl.lastAttack = now; }
        }
        let bots = p.bots.filter(b => b.health > 0).map(bot => {
          const { bot: ub, newBullets } = botAI(bot, pl);
          bullets.push(...newBullets);
          return ub;
        });
        bullets = bullets.map(b => ({ ...b, x: b.x + b.dx, y: b.y + b.dy })).filter(b => b.x > 0 && b.x < MAP_WIDTH && b.y > 0 && b.y < MAP_HEIGHT);
        bullets = bullets.filter(b => {
          if (b.ownerId !== 'player') {
            const d = Math.sqrt((b.x - pl.x) ** 2 + (b.y - pl.y) ** 2);
            if (d < PLAYER_SIZE / 2 + BULLET_SIZE) { pl.health -= SHELLY_DAMAGE; return false; }
          }
          for (let i = 0; i < bots.length; i++) {
            if (b.ownerId !== bots[i].id) {
              const d = Math.sqrt((b.x - bots[i].x) ** 2 + (b.y - bots[i].y) ** 2);
              if (d < PLAYER_SIZE / 2 + BULLET_SIZE) { bots[i] = { ...bots[i], health: bots[i].health - SHELLY_DAMAGE }; return false; }
            }
          }
          return true;
        });
        bots = bots.filter(b => b.health > 0);
        const cx = MAP_WIDTH / 2, cy = MAP_HEIGHT / 2;
        if (Math.sqrt((pl.x - cx) ** 2 + (pl.y - cy) ** 2) > p.poisonRadius) pl.health -= 80;
        bots = bots.map(b => Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2) > p.poisonRadius ? { ...b, health: b.health - 80 } : b).filter(b => b.health > 0);
        const alive = 1 + bots.length;
        let status: GameState['gameStatus'] = 'playing';
        if (pl.health <= 0) { status = 'lost'; if (timerRef.current) clearInterval(timerRef.current); }
        else if (bots.length === 0) { status = 'won'; if (timerRef.current) clearInterval(timerRef.current); }
        return { ...p, player: pl, bots, bullets, gameStatus: status, aliveCount: alive };
      });
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
    return () => { if (loopRef.current) cancelAnimationFrame(loopRef.current); };
  }, [gameState.gameStatus, shoot, botAI]);

  // ========== MENU ==========
  if (gameState.gameStatus === 'menu') {
    return (
      <View style={styles.menuContainer}>
        <View style={styles.menuBg}>
          <View style={styles.bgGradient1} />
          <View style={styles.bgGradient2} />
        </View>
        
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.profileBox}>
            <View style={styles.avatarCircle}>
              <Svg width={40} height={50}>
                <Circle cx={20} cy={20} r={15} fill="#9c27b0" />
                <Circle cx={20} cy={18} r={12} fill="#ffe0b2" />
                <Circle cx={15} cy={16} r={3} fill="#333" />
                <Circle cx={25} cy={16} r={3} fill="#333" />
                <Circle cx={14} cy={8} r={8} fill="#e91e63" />
                <Circle cx={26} cy={8} r={8} fill="#e91e63" />
              </Svg>
            </View>
            <View>
              <Text style={styles.profileName}>Player</Text>
              <View style={styles.trophyRow}>
                <FontAwesome5 name="trophy" size={12} color="#ffc107" />
                <Text style={styles.trophyText}>0</Text>
              </View>
            </View>
          </View>
          <View style={styles.topRightBtns}>
            <TouchableOpacity style={styles.topBtn}><Text style={styles.topBtnText}>CHAT</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuBtn}><Ionicons name="menu" size={24} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainArea}>
          {/* Left Sidebar */}
          <View style={styles.leftSide}>
            <TouchableOpacity style={styles.shopBtn}>
              <MaterialCommunityIcons name="store" size={24} color="#fff" />
              <Text style={styles.shopText}>SHOP</Text>
            </TouchableOpacity>
            <View style={styles.timerBox}>
              <Text style={styles.timerText}>0:00</Text>
              <Text style={styles.timerSub}>0/5</Text>
            </View>
            <View style={styles.levelBox}>
              <Text style={styles.levelNum}>1</Text>
              <Text style={styles.levelSub}>0/110</Text>
            </View>
          </View>

          {/* Center - Shelly 3D */}
          <View style={styles.centerArea}>
            <View style={styles.floatingIcons}>
              <View style={[styles.floatIcon, { left: '20%', top: 10 }]}><Text>😊</Text></View>
              <View style={[styles.floatIcon, { right: '30%', top: 20 }]}><Ionicons name="skull" size={16} color="#333" /></View>
              <View style={[styles.floatIcon, { right: '15%', top: 5 }]}><MaterialCommunityIcons name="star" size={16} color="#ffc107" /></View>
            </View>
            
            <View style={styles.shellyContainer}>
              <Svg width={280} height={220}>
                {/* Shelly 1 */}
                <Shelly3D x={80} y={140} health={MAX_HEALTH} maxHealth={MAX_HEALTH} isPlayer={false} scale={0.9} />
                {/* Shelly 2 */}
                <Shelly3D x={200} y={140} health={MAX_HEALTH} maxHealth={MAX_HEALTH} isPlayer={false} scale={0.9} />
              </Svg>
            </View>

            <View style={styles.favoriteTag}>
              <Ionicons name="heart" size={14} color="#e91e63" />
              <Text style={styles.favText}>FAVORITE</Text>
            </View>
            <TouchableOpacity style={styles.chooseBtn}>
              <Text style={styles.chooseText}>CHOOSE</Text>
            </TouchableOpacity>
          </View>

          {/* Right Sidebar */}
          <View style={styles.rightSide}>
            <TouchableOpacity style={styles.rightBtn}><FontAwesome5 name="trophy" size={18} color="#1976d2" /><Text style={styles.rightBtnText}>TOP</Text></TouchableOpacity>
            <TouchableOpacity style={styles.clubBtn}><Text style={styles.clubNum}>1000</Text><Text style={styles.clubText}>CLUB</Text></TouchableOpacity>
            <View style={styles.dailyBox}>
              <Text style={styles.dailyTitle}>DAILY WINS!</Text>
              <View style={styles.dailyIcons}>
                {['#ffc107', '#4caf50', '#f44336', '#2196f3', '#9c27b0'].map((c, i) => (
                  <View key={i} style={[styles.dailyIcon, { backgroundColor: c }]} />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.starrPass}>
            <Text style={styles.starrTitle}>STARR PASS</Text>
            <View style={styles.xpRow}>
              <Text style={styles.xpLabel}>XP</Text>
              <View style={styles.xpBarBg}><View style={styles.xpBarFill} /></View>
              <Text style={styles.xpNum}>0/150</Text>
            </View>
          </View>
          
          <View style={styles.modePlay}>
            <TouchableOpacity style={styles.modeBox}>
              <View style={styles.modeIcon}><Ionicons name="skull" size={24} color="#fff" /></View>
              <View>
                <Text style={styles.modeTimer}>5:04</Text>
                <Text style={styles.modeName}>SHOWDOWN</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.playBtn} onPress={startLoading}>
              <Text style={styles.playText}>PLAY</Text>
            </TouchableOpacity>
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
        <Text style={styles.loadSub}>Every Brawler for themselves!</Text>
        <View style={styles.playerGrid}>
          {[...Array(10)].map((_, i) => (
            <View key={i} style={[styles.playerCard, { backgroundColor: ['#4caf50', '#d32f2f', '#1976d2', '#00897b', '#f57c00', '#7b1fa2', '#388e3c', '#424242', '#0097a7', '#c62828'][i] }]}>
              <Text style={styles.cardRank}>{i + 1}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.countdown}>Match starts in: {loadingCountdown}</Text>
      </View>
    );
  }

  // ========== GAME OVER ==========
  if (gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') {
    const won = gameState.gameStatus === 'won';
    return (
      <View style={[styles.gameOverBg, won ? styles.wonBg : styles.lostBg]}>
        {won ? <FontAwesome5 name="trophy" size={100} color="#ffc107" /> : <Ionicons name="skull" size={100} color="#f44336" />}
        <Text style={styles.gameOverTitle}>{won ? '#1 VICTORY!' : 'DEFEATED'}</Text>
        <Text style={styles.gameOverSub}>{won ? '+8 Trophies' : `#${gameState.aliveCount + 1} Place`}</Text>
        <TouchableOpacity style={styles.againBtn} onPress={startLoading}><Text style={styles.againText}>PLAY AGAIN</Text></TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => setGameState(p => ({ ...p, gameStatus: 'menu' }))}><Text style={styles.homeText}>MAIN MENU</Text></TouchableOpacity>
      </View>
    );
  }

  // ========== GAMEPLAY ==========
  return (
    <View style={styles.gameContainer}>
      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudTimer}>
          <Ionicons name="skull" size={20} color="#fff" />
          <Text style={styles.hudTimerText}>:{gameState.matchTime}</Text>
        </View>
        <View style={styles.hudAlive}>
          <Text style={styles.hudAliveText}>{gameState.aliveCount}</Text>
          <Ionicons name="people" size={18} color="#fff" />
        </View>
      </View>

      {/* Game Map */}
      <View style={styles.mapWrap}>
        <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
          {/* Tiles */}
          {mapData.map((row, y) => row.map((tile, x) => (
            <Tile3D key={`${x}-${y}`} x={x * TILE_SIZE} y={y * TILE_SIZE} type={tile} size={TILE_SIZE} />
          )))}
          
          {/* Poison zone */}
          <Circle cx={MAP_WIDTH / 2} cy={MAP_HEIGHT / 2} r={gameState.poisonRadius} fill="none" stroke="#9c27b0" strokeWidth={5} strokeDasharray="12,6" opacity={0.7} />
          <Circle cx={MAP_WIDTH / 2} cy={MAP_HEIGHT / 2} r={gameState.poisonRadius + 8} fill="none" stroke="#7b1fa2" strokeWidth={2} strokeDasharray="8,4" opacity={0.4} />

          {/* Bullets */}
          {gameState.bullets.map(b => <Bullet3D key={b.id} x={b.x} y={b.y} isPlayer={b.ownerId === 'player'} />)}

          {/* Bots */}
          {gameState.bots.map(bot => <Bot3D key={bot.id} x={bot.x} y={bot.y} health={bot.health} maxHealth={bot.maxHealth} color={bot.color} name={bot.name} />)}

          {/* Player (Shelly) */}
          <Shelly3D x={gameState.player.x} y={gameState.player.y} health={gameState.player.health} maxHealth={gameState.player.maxHealth} isPlayer={true} scale={1} />
        </Svg>
      </View>

      {/* Emotes */}
      <View style={styles.emotePanel}>
        {['😀', '😠', '😢', '👍'].map((e, i) => (
          <TouchableOpacity key={i} style={styles.emoteBtn}><Text style={styles.emoteText}>{e}</Text></TouchableOpacity>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Joystick3D type="move" onMove={(dx, dy) => { moveDir.current = { dx, dy }; }} onRelease={() => { moveDir.current = { dx: 0, dy: 0 }; }} />
        <View style={styles.rightCtrl}>
          <TouchableOpacity style={styles.superBtn}>
            <MaterialCommunityIcons name="star-four-points" size={36} color="#ffc107" />
          </TouchableOpacity>
          <Joystick3D type="attack" onMove={(dx, dy) => { attackDir.current = { dx, dy }; attacking.current = true; }} onRelease={() => { attackDir.current = { dx: 0, dy: 0 }; attacking.current = false; }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Menu
  menuContainer: { flex: 1, backgroundColor: '#0d5c6e' },
  menuBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bgGradient1: { position: 'absolute', top: '15%', left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,230,230,0.12)', transform: [{ skewY: '-3deg' }] },
  bgGradient2: { position: 'absolute', top: '45%', left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,230,230,0.08)', transform: [{ skewY: '2deg' }] },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: Platform.OS === 'ios' ? 50 : 15, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.35)' },
  profileBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a4a5c', borderRadius: 25, paddingRight: 15, paddingVertical: 5 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#9c27b0', justifyContent: 'center', alignItems: 'center', marginLeft: 3 },
  profileName: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 10 },
  trophyRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 10, marginTop: 2 },
  trophyText: { color: '#ffc107', fontSize: 13, fontWeight: 'bold', marginLeft: 5 },
  topRightBtns: { flexDirection: 'row', alignItems: 'center' },
  topBtn: { backgroundColor: '#1a4a5c', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, marginRight: 10 },
  topBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  menuBtn: { padding: 8 },
  
  mainArea: { flex: 1, flexDirection: 'row' },
  leftSide: { width: 75, alignItems: 'center', paddingTop: 20 },
  shopBtn: { backgroundColor: '#4caf50', width: 60, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  shopText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  timerBox: { backgroundColor: '#ffc107', width: 55, borderRadius: 10, padding: 8, alignItems: 'center', marginBottom: 15 },
  timerText: { color: '#333', fontSize: 14, fontWeight: 'bold' },
  timerSub: { color: '#333', fontSize: 10, marginTop: 2 },
  levelBox: { backgroundColor: '#1976d2', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#ffc107' },
  levelNum: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  levelSub: { color: '#fff', fontSize: 8 },
  
  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  floatingIcons: { position: 'absolute', top: 0, left: 0, right: 0, height: 50 },
  floatIcon: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  shellyContainer: { marginBottom: 10 },
  favoriteTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(233,30,99,0.25)', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20 },
  favText: { color: '#e91e63', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  chooseBtn: { backgroundColor: '#1a4a5c', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 15, borderWidth: 2, borderColor: '#1976d2' },
  chooseText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  
  rightSide: { width: 85, alignItems: 'center', paddingTop: 20 },
  rightBtn: { backgroundColor: '#1a4a5c', width: 65, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#1976d2' },
  rightBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginTop: 3 },
  clubBtn: { backgroundColor: '#4caf50', width: 65, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  clubNum: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  clubText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  dailyBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 10, alignItems: 'center' },
  dailyTitle: { color: '#ffc107', fontSize: 9, fontWeight: 'bold', marginBottom: 6 },
  dailyIcons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dailyIcon: { width: 20, height: 20, borderRadius: 5, margin: 2 },
  
  bottomBar: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 15, paddingTop: 12, backgroundColor: 'rgba(0,0,0,0.4)' },
  starrPass: { flex: 1 },
  starrTitle: { color: '#4caf50', fontSize: 13, fontWeight: 'bold', marginBottom: 6 },
  xpRow: { flexDirection: 'row', alignItems: 'center' },
  xpLabel: { color: '#ffc107', fontSize: 11, fontWeight: 'bold', marginRight: 6 },
  xpBarBg: { flex: 1, height: 14, backgroundColor: '#333', borderRadius: 7 },
  xpBarFill: { width: '0%', height: '100%', backgroundColor: '#ffc107', borderRadius: 7 },
  xpNum: { color: '#fff', fontSize: 11, marginLeft: 8 },
  modePlay: { flexDirection: 'row', alignItems: 'center', marginLeft: 15 },
  modeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', borderRadius: 12, padding: 10, marginRight: 12 },
  modeIcon: { width: 45, height: 45, borderRadius: 22, backgroundColor: '#f44336', justifyContent: 'center', alignItems: 'center' },
  modeTimer: { color: '#888', fontSize: 11, marginLeft: 10 },
  modeName: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 10 },
  playBtn: { backgroundColor: '#ffc107', paddingHorizontal: 35, paddingVertical: 18, borderRadius: 12, elevation: 8, shadowColor: '#ffc107', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6 },
  playText: { color: '#000', fontSize: 24, fontWeight: 'bold' },

  // Loading
  loadingContainer: { flex: 1, backgroundColor: '#1b263b', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadTitle: { color: '#f44336', fontSize: 36, fontWeight: 'bold' },
  loadSub: { color: '#fff', fontSize: 17, marginTop: 8, marginBottom: 30 },
  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  playerCard: { width: 55, height: 65, borderRadius: 10, justifyContent: 'flex-end', alignItems: 'center', margin: 5, paddingBottom: 8 },
  cardRank: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  countdown: { color: '#ffc107', fontSize: 28, fontWeight: 'bold', marginTop: 35 },

  // Game Over
  gameOverBg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wonBg: { backgroundColor: '#1b3d1b' },
  lostBg: { backgroundColor: '#3d1b1b' },
  gameOverTitle: { color: '#fff', fontSize: 40, fontWeight: 'bold', marginTop: 25 },
  gameOverSub: { color: '#aaa', fontSize: 20, marginTop: 12 },
  againBtn: { backgroundColor: '#4caf50', paddingHorizontal: 45, paddingVertical: 18, borderRadius: 30, marginTop: 45 },
  againText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  homeBtn: { backgroundColor: '#1976d2', paddingHorizontal: 45, paddingVertical: 18, borderRadius: 30, marginTop: 18 },
  homeText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Gameplay
  gameContainer: { flex: 1, backgroundColor: '#1b263b' },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
  hudTimer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f44336', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  hudTimerText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 6 },
  hudAlive: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  hudAliveText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginRight: 6 },
  mapWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emotePanel: { position: 'absolute', right: 12, top: '28%', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 10 },
  emoteBtn: { width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginVertical: 4 },
  emoteText: { fontSize: 26 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, paddingBottom: Platform.OS === 'ios' ? 30 : 18, height: 160 },
  rightCtrl: { alignItems: 'center' },
  superBtn: { width: 60, height: 60, backgroundColor: '#333', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 4, borderColor: '#ffc107' },
  
  joystickContainer: { alignItems: 'center', justifyContent: 'center' },
  joystickGlow: { position: 'absolute', borderRadius: 100 },
  joystickBase3D: { borderRadius: 100, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  joystickBaseInner: { borderRadius: 100, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  joystickKnob3D: { position: 'absolute', borderRadius: 100, justifyContent: 'center', alignItems: 'center', elevation: 12, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 8 },
  knobHighlight: { position: 'absolute', top: 5, left: '20%', width: '40%', height: 10, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 5 },
  crosshair3D: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  crosshairH: { position: 'absolute', width: 24, height: 4, borderRadius: 2 },
  crosshairV: { position: 'absolute', width: 4, height: 24, borderRadius: 2 },
  crosshairDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
});
