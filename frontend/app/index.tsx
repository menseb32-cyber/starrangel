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
import Svg, { Circle, Rect, Path, Defs, LinearGradient, RadialGradient, Stop, G, Ellipse, Polygon, ClipPath } from 'react-native-svg';
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
  player: Character; bots: Character[]; bullets: Bullet[]; poisonRadius: number;
  gameStatus: 'welcome' | 'menu' | 'loading' | 'playing' | 'won' | 'lost';
  aliveCount: number; matchTime: number; playerName: string; trophies: number;
}

// Joystick
const Joystick3D = ({ type, onMove, onRelease }: { type: 'move' | 'attack'; onMove: (dx: number, dy: number) => void; onRelease: () => void }) => {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const size = type === 'move' ? 110 : 100;
  const knobSize = 55;
  const maxDist = (size - knobSize) / 2;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => setActive(true),
    onPanResponderMove: (_, g) => { const dist = Math.min(Math.sqrt(g.dx ** 2 + g.dy ** 2), maxDist); const angle = Math.atan2(g.dy, g.dx); setKnobPos({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }); onMove(Math.cos(angle) * dist / maxDist, Math.sin(angle) * dist / maxDist); },
    onPanResponderRelease: () => { setKnobPos({ x: 0, y: 0 }); setActive(false); onRelease(); },
  })).current;
  const baseColor = type === 'move' ? '#2196F3' : '#F44336';
  return (
    <View style={styles.joystickContainer} {...panResponder.panHandlers}>
      <View style={[styles.joystickBase3D, { width: size, height: size }]}><View style={[styles.joystickBaseInner, { width: size - 8, height: size - 8, backgroundColor: `${baseColor}40`, borderColor: baseColor }]} /></View>
      <View style={[styles.joystickKnob3D, { width: knobSize, height: knobSize, backgroundColor: active ? baseColor : `${baseColor}cc`, transform: [{ translateX: knobPos.x }, { translateY: knobPos.y }] }]}>
        {type === 'attack' && <View style={styles.crosshair3D}><View style={styles.crosshairH} /><View style={styles.crosshairV} /><View style={styles.crosshairDot} /></View>}
      </View>
    </View>
  );
};

// ============ IMPROVED HIGH-QUALITY BRAWLER ============
const ImprovedBrawler = ({ x, y, scale = 1, variant = 'pink' }: { x: number; y: number; scale?: number; variant?: 'pink' | 'blue' | 'red' | 'green' }) => {
  const s = scale;
  
  // Color schemes for different variants
  const colors = {
    pink: { hair: '#E91E63', hairLight: '#F48FB1', hairDark: '#AD1457', shirt: '#7B1FA2', shirtLight: '#AB47BC' },
    blue: { hair: '#2196F3', hairLight: '#64B5F6', hairDark: '#1565C0', shirt: '#1976D2', shirtLight: '#42A5F5' },
    red: { hair: '#F44336', hairLight: '#E57373', hairDark: '#C62828', shirt: '#D32F2F', shirtLight: '#EF5350' },
    green: { hair: '#4CAF50', hairLight: '#81C784', hairDark: '#2E7D32', shirt: '#388E3C', shirtLight: '#66BB6A' },
  };
  const c = colors[variant];

  return (
    <G>
      <Defs>
        {/* Skin gradient */}
        <LinearGradient id={`skin-${variant}-${x}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFE4C4" />
          <Stop offset="50%" stopColor="#FFDAB9" />
          <Stop offset="100%" stopColor="#DEB887" />
        </LinearGradient>
        {/* Hair gradient */}
        <LinearGradient id={`hair-${variant}-${x}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={c.hairLight} />
          <Stop offset="100%" stopColor={c.hairDark} />
        </LinearGradient>
        {/* Shirt gradient */}
        <LinearGradient id={`shirt-${variant}-${x}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={c.shirtLight} />
          <Stop offset="100%" stopColor={c.shirt} />
        </LinearGradient>
      </Defs>

      {/* Ground Shadow */}
      <Ellipse cx={x} cy={y + 90 * s} rx={28 * s} ry={10 * s} fill="rgba(0,0,0,0.25)" />

      {/* === LEGS === */}
      {/* Left leg */}
      <Path d={`M ${x - 18 * s} ${y + 50 * s} 
                L ${x - 20 * s} ${y + 78 * s} 
                Q ${x - 20 * s} ${y + 85 * s} ${x - 14 * s} ${y + 85 * s}
                L ${x - 6 * s} ${y + 85 * s}
                Q ${x - 2 * s} ${y + 85 * s} ${x - 2 * s} ${y + 78 * s}
                L ${x - 4 * s} ${y + 50 * s} Z`} 
            fill="#1A237E" stroke="#0D1B4C" strokeWidth={1} />
      {/* Left leg highlight */}
      <Rect x={x - 18 * s} y={y + 52 * s} width={4 * s} height={26 * s} rx={2} fill="#283593" opacity={0.6} />
      
      {/* Right leg */}
      <Path d={`M ${x + 4 * s} ${y + 50 * s} 
                L ${x + 2 * s} ${y + 78 * s} 
                Q ${x + 2 * s} ${y + 85 * s} ${x + 8 * s} ${y + 85 * s}
                L ${x + 16 * s} ${y + 85 * s}
                Q ${x + 20 * s} ${y + 85 * s} ${x + 20 * s} ${y + 78 * s}
                L ${x + 18 * s} ${y + 50 * s} Z`} 
            fill="#1A237E" stroke="#0D1B4C" strokeWidth={1} />
      {/* Right leg highlight */}
      <Rect x={x + 5 * s} y={y + 52 * s} width={4 * s} height={26 * s} rx={2} fill="#283593" opacity={0.6} />

      {/* === SHOES === */}
      {/* Left shoe */}
      <Ellipse cx={x - 13 * s} cy={y + 86 * s} rx={11 * s} ry={6 * s} fill="#5D4037" />
      <Ellipse cx={x - 14 * s} cy={y + 84 * s} rx={9 * s} ry={4 * s} fill="#8D6E63" />
      <Ellipse cx={x - 16 * s} cy={y + 83 * s} rx={4 * s} ry={2 * s} fill="#A1887F" />
      {/* Right shoe */}
      <Ellipse cx={x + 13 * s} cy={y + 86 * s} rx={11 * s} ry={6 * s} fill="#5D4037" />
      <Ellipse cx={x + 12 * s} cy={y + 84 * s} rx={9 * s} ry={4 * s} fill="#8D6E63" />
      <Ellipse cx={x + 10 * s} cy={y + 83 * s} rx={4 * s} ry={2 * s} fill="#A1887F" />

      {/* === BODY/TORSO === */}
      {/* Main body shape */}
      <Path d={`M ${x - 26 * s} ${y + 15 * s}
                Q ${x - 30 * s} ${y + 35 * s} ${x - 24 * s} ${y + 52 * s}
                L ${x + 24 * s} ${y + 52 * s}
                Q ${x + 30 * s} ${y + 35 * s} ${x + 26 * s} ${y + 15 * s}
                Q ${x} ${y + 5 * s} ${x - 26 * s} ${y + 15 * s} Z`}
            fill={`url(#shirt-${variant}-${x})`} stroke={c.shirt} strokeWidth={1} />
      {/* Shirt details */}
      <Path d={`M ${x - 18 * s} ${y + 20 * s} Q ${x} ${y + 28 * s} ${x + 18 * s} ${y + 20 * s}`} 
            stroke={c.shirtLight} strokeWidth={3 * s} fill="none" opacity={0.5} />
      
      {/* === BANDANA ON BODY === */}
      <Path d={`M ${x - 20 * s} ${y + 8 * s} 
                L ${x + 20 * s} ${y + 8 * s} 
                L ${x + 14 * s} ${y + 22 * s} 
                L ${x - 14 * s} ${y + 22 * s} Z`} 
            fill="#FFC107" stroke="#F9A825" strokeWidth={1} />
      <Path d={`M ${x - 16 * s} ${y + 11 * s} L ${x + 16 * s} ${y + 11 * s}`} stroke="#FFEB3B" strokeWidth={3 * s} />
      <Circle cx={x} cy={y + 15 * s} r={3 * s} fill="#FFD54F" />

      {/* === ARMS === */}
      {/* Left arm */}
      <Ellipse cx={x - 32 * s} cy={y + 25 * s} rx={12 * s} ry={14 * s} fill={`url(#skin-${variant}-${x})`} stroke="#DEB887" strokeWidth={1} />
      <Ellipse cx={x - 34 * s} cy={y + 22 * s} rx={6 * s} ry={8 * s} fill="#FFE4C4" opacity={0.5} />
      {/* Left hand */}
      <Circle cx={x - 34 * s} cy={y + 38 * s} r={8 * s} fill={`url(#skin-${variant}-${x})`} stroke="#DEB887" strokeWidth={1} />
      
      {/* Right arm */}
      <Ellipse cx={x + 32 * s} cy={y + 25 * s} rx={12 * s} ry={14 * s} fill={`url(#skin-${variant}-${x})`} stroke="#DEB887" strokeWidth={1} />
      <Ellipse cx={x + 30 * s} cy={y + 22 * s} rx={6 * s} ry={8 * s} fill="#FFE4C4" opacity={0.5} />
      {/* Right hand */}
      <Circle cx={x + 34 * s} cy={y + 38 * s} r={8 * s} fill={`url(#skin-${variant}-${x})`} stroke="#DEB887" strokeWidth={1} />

      {/* === WEAPON (SHOTGUN) === */}
      {/* Gun body */}
      <Rect x={x + 32 * s} y={y + 18 * s} width={45 * s} height={12 * s} rx={3} fill="#5D4037" stroke="#3E2723" strokeWidth={1} />
      <Rect x={x + 34 * s} y={y + 20 * s} width={40 * s} height={4 * s} fill="#8D6E63" />
      <Rect x={x + 34 * s} y={y + 26 * s} width={40 * s} height={2 * s} fill="#4E342E" />
      {/* Gun barrel */}
      <Rect x={x + 72 * s} y={y + 14 * s} width={16 * s} height={18 * s} rx={4} fill="#424242" stroke="#212121" strokeWidth={1} />
      <Circle cx={x + 80 * s} cy={y + 23 * s} r={5 * s} fill="#212121" />
      <Circle cx={x + 80 * s} cy={y + 23 * s} r={3 * s} fill="#000" />
      {/* Gun handle */}
      <Rect x={x + 38 * s} y={y + 30 * s} width={10 * s} height={14 * s} rx={2} fill="#6D4C41" />

      {/* === HEAD === */}
      {/* Main head shape */}
      <Circle cx={x} cy={y - 22 * s} r={32 * s} fill={`url(#skin-${variant}-${x})`} stroke="#DEB887" strokeWidth={1.5} />
      {/* Face highlight */}
      <Ellipse cx={x - 10 * s} cy={y - 32 * s} rx={16 * s} ry={12 * s} fill="#FFE4C4" opacity={0.4} />

      {/* === HAIR === */}
      {/* Hair base */}
      <Circle cx={x - 26 * s} cy={y - 52 * s} r={24 * s} fill={`url(#hair-${variant}-${x})`} />
      <Circle cx={x + 26 * s} cy={y - 52 * s} r={24 * s} fill={`url(#hair-${variant}-${x})`} />
      <Circle cx={x} cy={y - 60 * s} r={28 * s} fill={c.hair} />
      
      {/* Side hair puffs */}
      <Circle cx={x - 38 * s} cy={y - 32 * s} r={18 * s} fill={c.hair} />
      <Circle cx={x + 38 * s} cy={y - 32 * s} r={18 * s} fill={c.hair} />
      
      {/* Hair spikes */}
      <Circle cx={x - 18 * s} cy={y - 76 * s} r={16 * s} fill={c.hairLight} />
      <Circle cx={x + 18 * s} cy={y - 74 * s} r={14 * s} fill={c.hairLight} />
      <Circle cx={x} cy={y - 80 * s} r={12 * s} fill={c.hairLight} />
      <Circle cx={x - 34 * s} cy={y - 60 * s} r={12 * s} fill={c.hairLight} />
      <Circle cx={x + 34 * s} cy={y - 58 * s} r={11 * s} fill={c.hairLight} />
      
      {/* Hair highlights */}
      <Circle cx={x - 20 * s} cy={y - 68 * s} r={7 * s} fill="#FCE4EC" opacity={0.7} />
      <Circle cx={x + 12 * s} cy={y - 74 * s} r={5 * s} fill="#FCE4EC" opacity={0.7} />
      <Circle cx={x + 30 * s} cy={y - 54 * s} r={4 * s} fill="#FCE4EC" opacity={0.6} />
      <Circle cx={x - 36 * s} cy={y - 50 * s} r={5 * s} fill="#FCE4EC" opacity={0.5} />

      {/* === BANDANA ON HEAD === */}
      <Rect x={x - 38 * s} y={y - 40 * s} width={76 * s} height={16 * s} rx={8} fill="#F9A825" stroke="#F57F17" strokeWidth={1} />
      <Rect x={x - 36 * s} y={y - 38 * s} width={72 * s} height={6 * s} rx={3} fill="#FFC107" />
      <Rect x={x - 34 * s} y={y - 36 * s} width={68 * s} height={3 * s} rx={1} fill="#FFEB3B" />
      {/* Bandana knot */}
      <Circle cx={x - 40 * s} cy={y - 32 * s} r={6 * s} fill="#FFC107" />
      <Circle cx={x - 46 * s} cy={y - 28 * s} r={5 * s} fill="#FFB300" />
      <Circle cx={x - 42 * s} cy={y - 24 * s} r={4 * s} fill="#FFB300" />

      {/* === EYES === */}
      {/* Left eye */}
      <Ellipse cx={x - 12 * s} cy={y - 18 * s} rx={10 * s} ry={13 * s} fill="white" stroke="#E0E0E0" strokeWidth={1} />
      <Ellipse cx={x - 12 * s} cy={y - 16 * s} rx={7 * s} ry={9 * s} fill="#4A4A4A" />
      <Ellipse cx={x - 12 * s} cy={y - 16 * s} rx={5 * s} ry={7 * s} fill="#1A1A1A" />
      <Circle cx={x - 10 * s} cy={y - 19 * s} r={3 * s} fill="white" />
      <Circle cx={x - 14 * s} cy={y - 14 * s} r={2 * s} fill="white" opacity={0.5} />
      
      {/* Right eye */}
      <Ellipse cx={x + 12 * s} cy={y - 18 * s} rx={10 * s} ry={13 * s} fill="white" stroke="#E0E0E0" strokeWidth={1} />
      <Ellipse cx={x + 12 * s} cy={y - 16 * s} rx={7 * s} ry={9 * s} fill="#4A4A4A" />
      <Ellipse cx={x + 12 * s} cy={y - 16 * s} rx={5 * s} ry={7 * s} fill="#1A1A1A" />
      <Circle cx={x + 14 * s} cy={y - 19 * s} r={3 * s} fill="white" />
      <Circle cx={x + 10 * s} cy={y - 14 * s} r={2 * s} fill="white" opacity={0.5} />

      {/* === EYEBROWS === */}
      <Path d={`M ${x - 24 * s} ${y - 34 * s} Q ${x - 12 * s} ${y - 42 * s} ${x - 2 * s} ${y - 34 * s}`} 
            stroke="#8D6E63" strokeWidth={4 * s} strokeLinecap="round" fill="none" />
      <Path d={`M ${x + 2 * s} ${y - 34 * s} Q ${x + 12 * s} ${y - 42 * s} ${x + 24 * s} ${y - 34 * s}`} 
            stroke="#8D6E63" strokeWidth={4 * s} strokeLinecap="round" fill="none" />

      {/* === NOSE === */}
      <Ellipse cx={x} cy={y - 8 * s} rx={4 * s} ry={3 * s} fill="#DEB887" />
      <Ellipse cx={x - 1 * s} cy={y - 9 * s} rx={2 * s} ry={1.5 * s} fill="#FFE4C4" opacity={0.6} />

      {/* === MOUTH === */}
      <Path d={`M ${x - 12 * s} ${y + 2 * s} Q ${x} ${y + 12 * s} ${x + 12 * s} ${y + 2 * s}`} 
            stroke="#6D4C41" strokeWidth={3 * s} strokeLinecap="round" fill="none" />
      {/* Smile highlight */}
      <Path d={`M ${x - 8 * s} ${y + 4 * s} Q ${x} ${y + 10 * s} ${x + 8 * s} ${y + 4 * s}`} 
            stroke="#8D6E63" strokeWidth={1.5 * s} strokeLinecap="round" fill="none" opacity={0.5} />

      {/* === CHEEKS (blush) === */}
      <Ellipse cx={x - 22 * s} cy={y - 6 * s} rx={6 * s} ry={4 * s} fill="#FFAB91" opacity={0.4} />
      <Ellipse cx={x + 22 * s} cy={y - 6 * s} rx={6 * s} ry={4 * s} fill="#FFAB91" opacity={0.4} />
    </G>
  );
};

// Small avatar for UI
const AvatarBrawler = ({ size = 44, variant = 'pink' }: { size?: number; variant?: string }) => {
  const colors: any = {
    pink: { hair: '#E91E63', shirt: '#7B1FA2' },
    blue: { hair: '#2196F3', shirt: '#1976D2' },
    red: { hair: '#F44336', shirt: '#D32F2F' },
    green: { hair: '#4CAF50', shirt: '#388E3C' },
  };
  const c = colors[variant] || colors.pink;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Rect x={0} y={0} width={60} height={60} rx={14} fill={c.shirt} />
      <Rect x={2} y={2} width={56} height={56} rx={12} fill={`${c.shirt}dd`} />
      {/* Face */}
      <Circle cx={30} cy={36} r={20} fill="#FFDAB9" />
      {/* Hair */}
      <Circle cx={18} cy={14} r={14} fill={c.hair} />
      <Circle cx={42} cy={14} r={14} fill={c.hair} />
      <Circle cx={30} cy={10} r={16} fill={c.hair} />
      <Circle cx={10} cy={28} r={10} fill={c.hair} />
      <Circle cx={50} cy={28} r={10} fill={c.hair} />
      {/* Bandana */}
      <Rect x={6} y={24} width={48} height={10} rx={5} fill="#FFC107" />
      <Rect x={8} y={26} width={44} height={4} rx={2} fill="#FFEB3B" />
      {/* Eyes */}
      <Ellipse cx={22} cy={34} rx={6} ry={8} fill="white" />
      <Ellipse cx={38} cy={34} rx={6} ry={8} fill="white" />
      <Circle cx={22} cy={35} r={4} fill="#333" />
      <Circle cx={38} cy={35} r={4} fill="#333" />
      <Circle cx={21} cy={33} r={2} fill="white" />
      <Circle cx={37} cy={33} r={2} fill="white" />
      {/* Smile */}
      <Path d="M 22 46 Q 30 54 38 46" stroke="#6D4C41" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
};

// Gameplay brawler (smaller, optimized)
const GameBrawler = ({ x, y, health, maxHealth, isPlayer, variant = 'pink' }: any) => {
  const hp = Math.max(0, health / maxHealth);
  const colors: any = {
    pink: { hair: '#E91E63', shirt: '#7B1FA2' },
    blue: { hair: '#2196F3', shirt: '#1976D2' },
    red: { hair: '#F44336', shirt: '#D32F2F' },
    green: { hair: '#4CAF50', shirt: '#388E3C' },
    orange: { hair: '#FF9800', shirt: '#F57C00' },
    cyan: { hair: '#00BCD4', shirt: '#0097A7' },
    purple: { hair: '#9C27B0', shirt: '#7B1FA2' },
    grey: { hair: '#607D8B', shirt: '#455A64' },
  };
  const c = colors[variant] || colors.pink;

  return (
    <G>
      {/* Shadow */}
      <Ellipse cx={x} cy={y + 24} rx={18} ry={7} fill="rgba(0,0,0,0.3)" />
      
      {/* Body */}
      <Circle cx={x} cy={y + 8} r={16} fill={c.shirt} />
      <Circle cx={x - 4} cy={y + 5} r={14} fill={`${c.shirt}cc`} />
      
      {/* Head */}
      <Circle cx={x} cy={y - 8} r={20} fill="#FFDAB9" />
      
      {/* Hair */}
      <Circle cx={x - 16} cy={y - 26} r={14} fill={c.hair} />
      <Circle cx={x + 16} cy={y - 26} r={14} fill={c.hair} />
      <Circle cx={x} cy={y - 30} r={16} fill={c.hair} />
      <Circle cx={x - 22} cy={y - 14} r={10} fill={c.hair} />
      <Circle cx={x + 22} cy={y - 14} r={10} fill={c.hair} />
      
      {/* Bandana */}
      <Rect x={x - 22} y={y - 18} width={44} height={10} rx={5} fill="#FFC107" />
      <Rect x={x - 20} y={y - 16} width={40} height={4} rx={2} fill="#FFEB3B" />
      
      {/* Eyes */}
      <Ellipse cx={x - 8} cy={y - 8} rx={6} ry={8} fill="white" />
      <Ellipse cx={x + 8} cy={y - 8} rx={6} ry={8} fill="white" />
      <Circle cx={x - 8} cy={y - 7} r={4} fill="#333" />
      <Circle cx={x + 8} cy={y - 7} r={4} fill="#333" />
      <Circle cx={x - 7} cy={y - 9} r={2} fill="white" />
      <Circle cx={x + 9} cy={y - 9} r={2} fill="white" />
      
      {/* Smile */}
      <Path d={`M ${x - 8} ${y + 2} Q ${x} ${y + 8} ${x + 8} ${y + 2}`} stroke="#6D4C41" strokeWidth={2} fill="none" />
      
      {/* Health bar */}
      <Rect x={x - 26} y={y - 48} width={52} height={12} rx={6} fill="#1a1a1a" />
      <Rect x={x - 24} y={y - 46} width={48 * hp} height={8} rx={4} fill={hp > 0.5 ? '#4CAF50' : hp > 0.25 ? '#FF9800' : '#F44336'} />
      <Rect x={x - 24} y={y - 46} width={48 * hp} height={3} rx={2} fill={hp > 0.5 ? '#81C784' : hp > 0.25 ? '#FFB74D' : '#E57373'} />
      
      {/* Name tag for player */}
      {isPlayer && (
        <>
          <Rect x={x - 28} y={y - 62} width={56} height={12} rx={6} fill="#4CAF50" />
          <Rect x={x - 26} y={y - 60} width={52} height={8} rx={4} fill="#388E3C" />
        </>
      )}
    </G>
  );
};

// Tile
const Tile3D = ({ x, y, type, size }: { x: number; y: number; type: string; size: number }) => {
  if (type === 'water') return <><Rect x={x} y={y} width={size} height={size} fill="#1565C0" /><Ellipse cx={x + size * 0.3} cy={y + size * 0.5} rx={8} ry={3} fill="#42A5F5" opacity={0.5} /></>;
  if (type === 'wall') return <><Rect x={x} y={y + 6} width={size} height={size - 6} fill="#3E2723" /><Rect x={x} y={y} width={size} height={size - 6} fill="#6D4C41" /><Rect x={x + 2} y={y + 2} width={size - 4} height={size - 10} fill="#8D6E63" /></>;
  if (type === 'bush') return <><Rect x={x} y={y} width={size} height={size} fill="#2E7D32" /><Circle cx={x + size / 2} cy={y + size / 2} r={size / 2 - 4} fill="#388E3C" /><Circle cx={x + size / 2 - 5} cy={y + size / 2 - 5} r={size / 3} fill="#4CAF50" /></>;
  return <><Rect x={x} y={y} width={size} height={size} fill="#8D6E63" /><Rect x={x + 1} y={y + 1} width={size - 2} height={size - 2} fill="#A1887F" /></>;
};

// Main Game
export default function BrawlStarsGame() {
  const [gameState, setGameState] = useState<GameState>({
    player: { id: 'player', x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, health: MAX_HEALTH, maxHealth: MAX_HEALTH, color: '#7B1FA2', name: 'Spieler', lastAttack: 0, powerCubes: 0 },
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
    const load = async () => { try { const name = await AsyncStorage.getItem('brawlPlayerName'); const trophies = await AsyncStorage.getItem('brawlTrophies'); if (name) setGameState(p => ({ ...p, gameStatus: 'menu', playerName: name, trophies: trophies ? parseInt(trophies) : 0 })); } catch (e) {} };
    load();
  }, []);

  const saveName = async (name: string) => { try { await AsyncStorage.setItem('brawlPlayerName', name); await AsyncStorage.setItem('brawlTrophies', '0'); } catch (e) {} };
  const handleNameSubmit = () => { if (nameInput.trim().length >= 3) { const n = nameInput.trim().substring(0, 15); saveName(n); setGameState(p => ({ ...p, playerName: n, gameStatus: 'menu' })); Keyboard.dismiss(); } };

  const [mapData] = useState(() => {
    const map: string[][] = [], rows = Math.floor(MAP_HEIGHT / TILE_SIZE), cols = Math.floor(MAP_WIDTH / TILE_SIZE);
    for (let y = 0; y < rows; y++) { map[y] = []; for (let x = 0; x < cols; x++) { if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) map[y][x] = 'water'; else if (Math.random() < 0.1) map[y][x] = 'wall'; else if (Math.random() < 0.18) map[y][x] = 'bush'; else map[y][x] = 'grass'; } }
    return map;
  });

  const botVariants = ['red', 'blue', 'green', 'orange', 'cyan', 'purple', 'grey', 'pink', 'red'];
  const initBots = useCallback(() => {
    const bots: Character[] = [], used: { x: number; y: number }[] = [];
    for (let i = 0; i < 9; i++) { let bx, by; do { bx = 60 + Math.random() * (MAP_WIDTH - 120); by = 60 + Math.random() * (MAP_HEIGHT - 120); } while (used.some(p => Math.abs(p.x - bx) < 70 && Math.abs(p.y - by) < 70)); used.push({ x: bx, y: by }); bots.push({ id: `bot-${i}`, x: bx, y: by, health: MAX_HEALTH, maxHealth: MAX_HEALTH, color: botVariants[i], name: `Bot${i + 1}`, lastAttack: 0, powerCubes: 0 }); }
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
        <View style={styles.welcomeChar}><Svg width={220} height={220}><ImprovedBrawler x={110} y={130} scale={0.7} variant="pink" /></Svg></View>
        <View style={styles.warningBox}><Ionicons name="warning" size={24} color="#ff1744" /><Text style={styles.warningText}>BENUTZE NICHT DEIN ECHTEN NAME!</Text></View>
        <View style={styles.nameInputBox}><Text style={styles.nameLabel}>Spielername eingeben:</Text><TextInput style={styles.nameInput} placeholder="Name (3-15 Zeichen)" placeholderTextColor="#888" value={nameInput} onChangeText={setNameInput} maxLength={15} /></View>
        <TouchableOpacity style={[styles.submitBtn, nameInput.trim().length < 3 && styles.submitBtnOff]} onPress={handleNameSubmit} disabled={nameInput.trim().length < 3}><Text style={styles.submitText}>SPIELEN</Text></TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  // ========== MENU ==========
  if (gameState.gameStatus === 'menu') {
    return (
      <View style={styles.menuContainer}>
        <View style={styles.menuBg}><View style={styles.bgS1} /><View style={styles.bgS2} /><View style={styles.bgR1} /><View style={styles.bgR2} /></View>
        <View style={styles.topBar}>
          <View style={styles.profileBox}><View style={styles.avatarBox}><AvatarBrawler size={44} variant="pink" /></View><View style={styles.profileInfo}><Text style={styles.profileName}>{gameState.playerName || 'Spieler'}</Text><View style={styles.trophyRow}><FontAwesome5 name="trophy" size={10} color="#FFC107" /><Text style={styles.trophyCount}>{gameState.trophies}</Text></View></View></View>
          <View style={styles.topIcons}>{[0, 0, 0, 0, 0].map((_, i) => <View key={i} style={styles.topIcon}><Text style={styles.topIconTxt}>0</Text></View>)}</View>
          <View style={styles.topRight}><View style={styles.chatBox}><Text style={styles.chatText}>CHAT</Text></View><TouchableOpacity><Ionicons name="menu" size={28} color="#fff" /></TouchableOpacity></View>
        </View>
        <View style={styles.mainContent}>
          <View style={styles.leftBar}>
            <View style={styles.allGames}><Text style={styles.allGamesTxt}>Alle Spiele</Text></View>
            <TouchableOpacity style={styles.shopBtn}><Text style={styles.shopTxt}>SHOP</Text></TouchableOpacity>
            <View style={styles.timerBox}><Text style={styles.timerTxt}>0:00</Text><Text style={styles.timerSub}>0/5</Text></View>
            <View style={styles.lvlBox}><Text style={styles.lvlNum}>1</Text></View>
          </View>
          <View style={styles.centerBox}>
            <View style={styles.floatIcons}><View style={styles.floatE}><Text>😊</Text></View><View style={styles.floatS}><Ionicons name="skull" size={14} color="#333" /></View></View>
            <View style={styles.trophyBadges}><View style={styles.badge}><FontAwesome5 name="trophy" size={10} color="#FFC107" /><Text style={styles.badgeTxt}>0</Text></View></View>
            {/* IMPROVED BRAWLERS */}
            <View style={styles.charsRow}>
              <Svg width={320} height={220}>
                <ImprovedBrawler x={90} y={130} scale={0.55} variant="pink" />
                <ImprovedBrawler x={230} y={130} scale={0.55} variant="pink" />
              </Svg>
            </View>
            <View style={styles.favTag}><Ionicons name="heart" size={12} color="#E91E63" /><Text style={styles.favTxt}>FAVORIT</Text></View>
            <TouchableOpacity style={styles.chooseBtn}><Text style={styles.chooseTxt}>WÄHLEN</Text></TouchableOpacity>
          </View>
          <View style={styles.rightBar}>
            <TouchableOpacity style={styles.topBtn}><FontAwesome5 name="trophy" size={16} color="#2196F3" /><Text style={styles.topBtnTxt}>TOP</Text></TouchableOpacity>
            <TouchableOpacity style={styles.clubBtn}><Text style={styles.clubNum}>🏆1000</Text><Text style={styles.clubTxt}>CLUB</Text></TouchableOpacity>
            <View style={styles.dailyBox}><Text style={styles.dailyTitle}>SIEGE!</Text><View style={styles.dailyIcons}>{['#FFC107', '#4CAF50', '#F44336', '#2196F3'].map((c, i) => <View key={i} style={[styles.dailyIcon, { backgroundColor: c }]} />)}</View></View>
          </View>
        </View>
        <View style={styles.bottomBar}>
          <View style={styles.starrPass}><Text style={styles.starrTitle}>⭐ STARR PASS</Text><View style={styles.xpRow}><Text style={styles.xpLbl}>XP</Text><View style={styles.xpBg}><View style={styles.xpFill} /></View><Text style={styles.xpNum}>0/150</Text></View></View>
          <View style={styles.modePlay}>
            <View style={styles.modeBox}><View style={styles.modeIcon}><Text style={styles.modeTxt}>0</Text></View><View><Text style={styles.modeTimer}>6:13</Text><View style={styles.modeRow}><Ionicons name="skull" size={14} color="#fff" /><Text style={styles.modeName}>SHOWDOWN</Text></View></View></View>
            <TouchableOpacity style={styles.playBtn} onPress={startLoading}><Text style={styles.playTxt}>SPIELEN</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ========== LOADING ==========
  if (gameState.gameStatus === 'loading') {
    return (
      <View style={styles.loadContainer}>
        <Text style={styles.loadTitle}>SHOWDOWN</Text>
        <Text style={styles.loadSub}>Jeder Brawler für sich!</Text>
        <View style={styles.playerGrid}>{[...Array(10)].map((_, i) => <View key={i} style={[styles.pCard, { backgroundColor: ['#4CAF50', '#F44336', '#2196F3', '#00897B', '#FF9800', '#7B1FA2', '#388E3C', '#607D8B', '#00BCD4', '#C62828'][i] }]}><Text style={styles.pRank}>{i + 1}</Text></View>)}</View>
        <Text style={styles.countdown}>Startet in: {loadingCountdown}</Text>
      </View>
    );
  }

  // ========== GAME OVER ==========
  if (gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') {
    const won = gameState.gameStatus === 'won';
    return (
      <View style={[styles.goBg, won ? styles.wonBg : styles.lostBg]}>
        {won ? <FontAwesome5 name="trophy" size={100} color="#FFC107" /> : <Ionicons name="skull" size={100} color="#F44336" />}
        <Text style={styles.goTitle}>{won ? '#1 SIEG!' : 'BESIEGT'}</Text>
        <Text style={styles.goSub}>{won ? '+8 Trophäen' : `#${gameState.aliveCount + 1} Platz`}</Text>
        <TouchableOpacity style={styles.againBtn} onPress={startLoading}><Text style={styles.againTxt}>NOCHMAL</Text></TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => setGameState(p => ({ ...p, gameStatus: 'menu' }))}><Text style={styles.homeTxt}>MENÜ</Text></TouchableOpacity>
      </View>
    );
  }

  // ========== GAMEPLAY ==========
  return (
    <View style={styles.gameContainer}>
      <View style={styles.hud}><View style={styles.hudTimer}><Ionicons name="skull" size={18} color="#fff" /><Text style={styles.hudTimerTxt}>:{gameState.matchTime}</Text></View><View style={styles.hudAlive}><Text style={styles.hudAliveTxt}>{gameState.aliveCount}</Text><Ionicons name="people" size={16} color="#fff" /></View></View>
      <View style={styles.mapWrap}>
        <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
          {mapData.map((row, y) => row.map((tile, x) => <Tile3D key={`${x}-${y}`} x={x * TILE_SIZE} y={y * TILE_SIZE} type={tile} size={TILE_SIZE} />))}
          <Circle cx={MAP_WIDTH / 2} cy={MAP_HEIGHT / 2} r={gameState.poisonRadius} fill="none" stroke="#9C27B0" strokeWidth={4} strokeDasharray="10,5" opacity={0.7} />
          {gameState.bullets.map(b => <Circle key={b.id} cx={b.x} cy={b.y} r={BULLET_SIZE} fill={b.ownerId === 'player' ? '#FF9800' : '#F44336'} />)}
          {gameState.bots.map((bot, i) => <GameBrawler key={bot.id} x={bot.x} y={bot.y} health={bot.health} maxHealth={bot.maxHealth} isPlayer={false} variant={botVariants[i]} />)}
          <GameBrawler x={gameState.player.x} y={gameState.player.y} health={gameState.player.health} maxHealth={gameState.player.maxHealth} isPlayer={true} variant="pink" />
        </Svg>
      </View>
      <View style={styles.emotes}>{['😀', '😠', '😢', '👍'].map((e, i) => <TouchableOpacity key={i} style={styles.emoteBtn}><Text style={styles.emoteTxt}>{e}</Text></TouchableOpacity>)}</View>
      <View style={styles.controls}>
        <Joystick3D type="move" onMove={(dx, dy) => { moveDir.current = { dx, dy }; }} onRelease={() => { moveDir.current = { dx: 0, dy: 0 }; }} />
        <View style={styles.rightCtrl}><TouchableOpacity style={styles.superBtn}><MaterialCommunityIcons name="star-four-points" size={34} color="#FFC107" /></TouchableOpacity><Joystick3D type="attack" onMove={(dx, dy) => { attackDir.current = { dx, dy }; attacking.current = true; }} onRelease={() => { attackDir.current = { dx: 0, dy: 0 }; attacking.current = false; }} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Welcome
  welcomeContainer: { flex: 1, backgroundColor: '#0D47A1', alignItems: 'center', justifyContent: 'center', padding: 20 },
  welcomeBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1565C0' },
  logoText: { fontSize: 50, fontWeight: 'bold', color: '#FFC107' },
  logoText2: { fontSize: 50, fontWeight: 'bold', color: '#FF5722', marginTop: -12 },
  welcomeChar: { marginVertical: 10 },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,23,68,0.2)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: '#FF1744', marginBottom: 18 },
  warningText: { color: '#FF1744', fontSize: 12, fontWeight: 'bold', marginLeft: 8 },
  nameInputBox: { width: '100%', maxWidth: 300, marginBottom: 18 },
  nameLabel: { color: '#fff', fontSize: 14, marginBottom: 8, textAlign: 'center' },
  nameInput: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16, color: '#333', textAlign: 'center' },
  submitBtn: { backgroundColor: '#FFC107', paddingHorizontal: 45, paddingVertical: 14, borderRadius: 28 },
  submitBtnOff: { backgroundColor: '#666', opacity: 0.6 },
  submitText: { color: '#000', fontSize: 20, fontWeight: 'bold' },

  // Menu
  menuContainer: { flex: 1, backgroundColor: '#000' },
  menuBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00ACC1' },
  bgS1: { position: 'absolute', bottom: '20%', left: '10%', width: 70, height: 110, backgroundColor: '#00838F', transform: [{ rotate: '15deg' }], borderRadius: 8 },
  bgS2: { position: 'absolute', bottom: '25%', right: '15%', width: 90, height: 140, backgroundColor: '#00838F', transform: [{ rotate: '-10deg' }], borderRadius: 8 },
  bgR1: { position: 'absolute', top: 0, left: '30%', width: 90, height: '100%', backgroundColor: 'rgba(255,255,255,0.04)', transform: [{ skewX: '-15deg' }] },
  bgR2: { position: 'absolute', top: 0, right: '20%', width: 70, height: '100%', backgroundColor: 'rgba(255,255,255,0.03)', transform: [{ skewX: '10deg' }] },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingTop: Platform.OS === 'ios' ? 45 : 10, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  profileBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A3A4A', borderRadius: 22, paddingRight: 12 },
  avatarBox: { marginLeft: -2 },
  profileInfo: { marginLeft: 6 },
  profileName: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  trophyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  trophyCount: { color: '#FFC107', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  topIcons: { flexDirection: 'row' },
  topIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1A3A4A', justifyContent: 'center', alignItems: 'center', marginHorizontal: 2 },
  topIconTxt: { color: '#888', fontSize: 9 },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  chatBox: { backgroundColor: '#1A3A4A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 8 },
  chatText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  mainContent: { flex: 1, flexDirection: 'row' },
  leftBar: { width: 65, alignItems: 'center', paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.4)' },
  allGames: { backgroundColor: '#333', paddingVertical: 20, paddingHorizontal: 4, borderTopRightRadius: 6, borderBottomRightRadius: 6, marginBottom: 10, marginLeft: -65, paddingLeft: 65 },
  allGamesTxt: { color: '#fff', fontSize: 8, fontWeight: 'bold', transform: [{ rotate: '-90deg' }], width: 50 },
  shopBtn: { backgroundColor: '#4CAF50', width: 50, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  shopTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  timerBox: { backgroundColor: '#FFC107', width: 45, borderRadius: 6, padding: 4, alignItems: 'center', marginBottom: 8 },
  timerTxt: { color: '#333', fontSize: 11, fontWeight: 'bold' },
  timerSub: { color: '#333', fontSize: 8 },
  lvlBox: { backgroundColor: '#2196F3', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFC107' },
  lvlNum: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  floatIcons: { flexDirection: 'row', position: 'absolute', top: 5, width: '80%', justifyContent: 'space-around' },
  floatE: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  floatS: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  trophyBadges: { flexDirection: 'row', marginBottom: 5 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A237E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeTxt: { color: '#FFC107', fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  charsRow: { marginVertical: 5 },
  favTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(233,30,99,0.3)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, marginTop: 5 },
  favTxt: { color: '#E91E63', fontSize: 10, fontWeight: 'bold', marginLeft: 5 },
  chooseBtn: { backgroundColor: '#1A3A4A', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 18, marginTop: 8, borderWidth: 2, borderColor: '#2196F3' },
  chooseTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  rightBar: { width: 75, alignItems: 'center', paddingTop: 10 },
  topBtn: { backgroundColor: '#1A3A4A', width: 55, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: '#2196F3' },
  topBtnTxt: { color: '#fff', fontSize: 9, fontWeight: 'bold', marginTop: 2 },
  clubBtn: { backgroundColor: '#4CAF50', width: 55, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  clubNum: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  clubTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  dailyBox: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 6, alignItems: 'center' },
  dailyTitle: { color: '#FFC107', fontSize: 8, fontWeight: 'bold', marginBottom: 4 },
  dailyIcons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dailyIcon: { width: 16, height: 16, borderRadius: 4, margin: 2 },
  bottomBar: { flexDirection: 'row', paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 25 : 12, paddingTop: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  starrPass: { flex: 1 },
  starrTitle: { color: '#4CAF50', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  xpRow: { flexDirection: 'row', alignItems: 'center' },
  xpLbl: { color: '#FFC107', fontSize: 9, fontWeight: 'bold', marginRight: 4 },
  xpBg: { flex: 1, height: 10, backgroundColor: '#333', borderRadius: 5 },
  xpFill: { width: '0%', height: '100%', backgroundColor: '#FFC107', borderRadius: 5 },
  xpNum: { color: '#fff', fontSize: 9, marginLeft: 5 },
  modePlay: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  modeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', borderRadius: 8, padding: 6, marginRight: 8 },
  modeIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F44336', justifyContent: 'center', alignItems: 'center' },
  modeTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  modeTimer: { color: '#888', fontSize: 9, marginLeft: 6 },
  modeRow: { flexDirection: 'row', alignItems: 'center' },
  modeName: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginLeft: 3 },
  playBtn: { backgroundColor: '#FFC107', paddingHorizontal: 26, paddingVertical: 12, borderRadius: 10 },
  playTxt: { color: '#000', fontSize: 18, fontWeight: 'bold' },

  // Loading
  loadContainer: { flex: 1, backgroundColor: '#1B263B', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadTitle: { color: '#F44336', fontSize: 32, fontWeight: 'bold' },
  loadSub: { color: '#fff', fontSize: 15, marginTop: 6, marginBottom: 22 },
  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  pCard: { width: 50, height: 60, borderRadius: 8, justifyContent: 'flex-end', alignItems: 'center', margin: 4, paddingBottom: 6 },
  pRank: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  countdown: { color: '#FFC107', fontSize: 24, fontWeight: 'bold', marginTop: 28 },

  // Game Over
  goBg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wonBg: { backgroundColor: '#1B3D1B' },
  lostBg: { backgroundColor: '#3D1B1B' },
  goTitle: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginTop: 18 },
  goSub: { color: '#aaa', fontSize: 16, marginTop: 8 },
  againBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 38, paddingVertical: 14, borderRadius: 22, marginTop: 35 },
  againTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  homeBtn: { backgroundColor: '#2196F3', paddingHorizontal: 38, paddingVertical: 14, borderRadius: 22, marginTop: 12 },
  homeTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  // Gameplay
  gameContainer: { flex: 1, backgroundColor: '#1B263B' },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  hudTimer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F44336', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18 },
  hudTimerTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 5 },
  hudAlive: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18 },
  hudAliveTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginRight: 5 },
  mapWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emotes: { position: 'absolute', right: 10, top: '28%', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 22, padding: 8 },
  emoteBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', marginVertical: 3 },
  emoteTxt: { fontSize: 22 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: Platform.OS === 'ios' ? 26 : 14, height: 150 },
  rightCtrl: { alignItems: 'center' },
  superBtn: { width: 52, height: 52, backgroundColor: '#333', borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 3, borderColor: '#FFC107' },

  joystickContainer: { alignItems: 'center', justifyContent: 'center' },
  joystickBase3D: { borderRadius: 100, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  joystickBaseInner: { borderRadius: 100, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  joystickKnob3D: { position: 'absolute', borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  crosshair3D: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  crosshairH: { position: 'absolute', width: 20, height: 4, backgroundColor: '#fff', borderRadius: 2 },
  crosshairV: { position: 'absolute', width: 4, height: 20, backgroundColor: '#fff', borderRadius: 2 },
  crosshairDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
});
