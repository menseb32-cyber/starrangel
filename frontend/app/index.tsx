import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Path, Defs, LinearGradient, RadialGradient, Stop, G, Ellipse, Polygon } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather, AntDesign } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game Constants
const GAME_WIDTH = Math.min(SCREEN_WIDTH, 500);
const GAME_HEIGHT = SCREEN_HEIGHT - 180;
const MAP_WIDTH = GAME_WIDTH;
const MAP_HEIGHT = GAME_HEIGHT - 60;
const TILE_SIZE = 32;
const PLAYER_SIZE = 36;
const BULLET_SIZE = 8;
const BULLET_SPEED = 10;
const PLAYER_SPEED = 4;
const BOT_SPEED = 2;
const MAX_HEALTH = 4000;
const SHELLY_DAMAGE = 420;
const ATTACK_COOLDOWN = 800;
const POISON_DAMAGE = 100;

// Types
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
  trophies: number;
  rank: number;
}

interface GameState {
  player: Character;
  bots: Character[];
  bullets: Bullet[];
  poisonRadius: number;
  gameStatus: 'menu' | 'loading' | 'playing' | 'won' | 'lost';
  aliveCount: number;
  matchTime: number;
  powerCubes: number;
}

// Brawl Stars Style Joystick
const BrawlJoystick = ({
  type,
  onMove,
  onRelease,
}: {
  type: 'move' | 'attack';
  onMove: (dx: number, dy: number) => void;
  onRelease: () => void;
}) => {
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const baseSize = type === 'move' ? 100 : 90;
  const knobSize = type === 'move' ? 50 : 45;
  const maxDistance = (baseSize - knobSize) / 2;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setIsActive(true),
      onPanResponderMove: (_, gestureState) => {
        const distance = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);
        const angle = Math.atan2(gestureState.dy, gestureState.dx);
        const clampedDistance = Math.min(distance, maxDistance);
        const newX = Math.cos(angle) * clampedDistance;
        const newY = Math.sin(angle) * clampedDistance;
        setKnobPosition({ x: newX, y: newY });
        onMove(newX / maxDistance, newY / maxDistance);
      },
      onPanResponderRelease: () => {
        setKnobPosition({ x: 0, y: 0 });
        setIsActive(false);
        onRelease();
      },
    })
  ).current;

  const baseColor = type === 'move' ? '#1E90FF' : '#DC143C';
  const activeColor = type === 'move' ? '#00BFFF' : '#FF4500';

  return (
    <View style={styles.joystickWrapper} {...panResponder.panHandlers}>
      <View style={[styles.joystickOuter, { width: baseSize + 20, height: baseSize + 20, borderColor: isActive ? activeColor : 'rgba(255,255,255,0.3)' }]}>
        <View style={[styles.joystickBase, { width: baseSize, height: baseSize, backgroundColor: isActive ? `${baseColor}40` : `${baseColor}20`, borderColor: baseColor }]}>
          <View style={[styles.joystickKnob, { width: knobSize, height: knobSize, backgroundColor: isActive ? activeColor : baseColor, transform: [{ translateX: knobPosition.x }, { translateY: knobPosition.y }] }]}>
            {type === 'attack' && (
              <View style={styles.crosshair}>
                <View style={[styles.crosshairLine, styles.crosshairH]} />
                <View style={[styles.crosshairLine, styles.crosshairV]} />
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

// Shelly Character Component
const ShellyCharacter = ({ size = 120, showTrophies = true, trophies = 0 }) => (
  <View style={{ alignItems: 'center' }}>
    {showTrophies && (
      <View style={styles.trophyBadge}>
        <FontAwesome5 name="trophy" size={10} color="#F1C40F" />
        <Text style={styles.trophyBadgeText}>{trophies}</Text>
      </View>
    )}
    <Svg width={size} height={size + 20}>
      {/* Body/Shirt */}
      <Rect x={size/2 - 25} y={size - 35} width={50} height={40} fill="#9B59B6" rx={8} />
      {/* Arms */}
      <Circle cx={size/2 - 30} cy={size - 15} r={12} fill="#FDBF6F" />
      <Circle cx={size/2 + 30} cy={size - 15} r={12} fill="#FDBF6F" />
      {/* Hands with weapon */}
      <Rect x={size/2 + 25} y={size - 25} width={25} height={8} fill="#8B4513" rx={2} />
      {/* Head */}
      <Circle cx={size/2} cy={size/2 - 5} r={35} fill="#FDBF6F" />
      {/* Hair */}
      <Circle cx={size/2 - 20} cy={size/2 - 35} r={20} fill="#E91E63" />
      <Circle cx={size/2 + 20} cy={size/2 - 35} r={20} fill="#E91E63" />
      <Circle cx={size/2} cy={size/2 - 40} r={25} fill="#E91E63" />
      <Circle cx={size/2 - 30} cy={size/2 - 20} r={12} fill="#E91E63" />
      <Circle cx={size/2 + 30} cy={size/2 - 20} r={12} fill="#E91E63" />
      {/* Bandana */}
      <Rect x={size/2 - 30} y={size/2 - 15} width={60} height={10} fill="#F1C40F" rx={5} />
      {/* Eyes */}
      <Ellipse cx={size/2 - 12} cy={size/2} rx={8} ry={10} fill="white" />
      <Ellipse cx={size/2 + 12} cy={size/2} rx={8} ry={10} fill="white" />
      <Circle cx={size/2 - 12} cy={size/2 + 2} r={5} fill="#333" />
      <Circle cx={size/2 + 12} cy={size/2 + 2} r={5} fill="#333" />
      <Circle cx={size/2 - 10} cy={size/2} r={2} fill="white" />
      <Circle cx={size/2 + 14} cy={size/2} r={2} fill="white" />
      {/* Eyebrows */}
      <Path d={`M ${size/2 - 20} ${size/2 - 15} Q ${size/2 - 12} ${size/2 - 20} ${size/2 - 4} ${size/2 - 15}`} stroke="#8B4513" strokeWidth={3} fill="none" />
      <Path d={`M ${size/2 + 4} ${size/2 - 15} Q ${size/2 + 12} ${size/2 - 20} ${size/2 + 20} ${size/2 - 15}`} stroke="#8B4513" strokeWidth={3} fill="none" />
      {/* Mouth */}
      <Path d={`M ${size/2 - 8} ${size/2 + 18} Q ${size/2} ${size/2 + 25} ${size/2 + 8} ${size/2 + 18}`} stroke="#333" strokeWidth={2} fill="none" />
      {/* Legs */}
      <Rect x={size/2 - 18} y={size + 5} width={14} height={15} fill="#1E3A5F" rx={3} />
      <Rect x={size/2 + 4} y={size + 5} width={14} height={15} fill="#1E3A5F" rx={3} />
    </Svg>
  </View>
);

// Small Brawler Icon
const BrawlerIcon = ({ color, size = 40 }) => (
  <View style={[styles.brawlerIcon, { width: size, height: size, backgroundColor: color }]}>
    <Svg width={size - 8} height={size - 8}>
      <Circle cx={(size-8)/2} cy={(size-8)/2 - 2} r={(size-8)/2 - 2} fill="#FDBF6F" />
      <Circle cx={(size-8)/2 - 5} cy={(size-8)/2 - 4} r={3} fill="#333" />
      <Circle cx={(size-8)/2 + 5} cy={(size-8)/2 - 4} r={3} fill="#333" />
    </Svg>
  </View>
);

// Main Game Component
export default function BrawlStarsGame() {
  const [gameState, setGameState] = useState<GameState>({
    player: {
      id: 'player',
      x: MAP_WIDTH / 2,
      y: MAP_HEIGHT / 2,
      health: MAX_HEALTH,
      maxHealth: MAX_HEALTH,
      color: '#9B59B6',
      name: 'Player',
      lastAttack: 0,
      trophies: 0,
      rank: 1,
    },
    bots: [],
    bullets: [],
    poisonRadius: Math.min(MAP_WIDTH, MAP_HEIGHT) / 2,
    gameStatus: 'menu',
    aliveCount: 1,
    matchTime: 120,
    powerCubes: 0,
  });

  const [loadingCountdown, setLoadingCountdown] = useState(3);
  const moveDirection = useRef({ dx: 0, dy: 0 });
  const attackDirection = useRef({ dx: 0, dy: 0 });
  const isAttacking = useRef(false);
  const gameLoopRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate Map
  const generateMap = useCallback(() => {
    const map: string[][] = [];
    const rows = Math.floor(MAP_HEIGHT / TILE_SIZE);
    const cols = Math.floor(MAP_WIDTH / TILE_SIZE);
    for (let y = 0; y < rows; y++) {
      map[y] = [];
      for (let x = 0; x < cols; x++) {
        if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) {
          map[y][x] = 'water';
        } else if (Math.random() < 0.08) {
          map[y][x] = 'wall';
        } else if (Math.random() < 0.15) {
          map[y][x] = 'bush';
        } else {
          map[y][x] = 'grass';
        }
      }
    }
    return map;
  }, []);

  const [mapData] = useState(generateMap);

  // Initialize Bots
  const initializeBots = useCallback(() => {
    const botData = [
      { name: 'Bull', color: '#E74C3C' },
      { name: 'Colt', color: '#3498DB' },
      { name: 'Nita', color: '#1ABC9C' },
      { name: 'Jessie', color: '#F39C12' },
      { name: 'Brock', color: '#9B59B6' },
      { name: 'Spike', color: '#2ECC71' },
      { name: 'Crow', color: '#333' },
      { name: 'Poco', color: '#00CED1' },
      { name: 'El Primo', color: '#FF6347' },
    ];
    const bots: Character[] = [];
    const usedPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < 9; i++) {
      let x, y;
      do {
        x = 50 + Math.random() * (MAP_WIDTH - 100);
        y = 50 + Math.random() * (MAP_HEIGHT - 100);
      } while (usedPositions.some(pos => Math.abs(pos.x - x) < 60 && Math.abs(pos.y - y) < 60));
      usedPositions.push({ x, y });
      bots.push({
        id: `bot-${i}`,
        x, y,
        health: MAX_HEALTH,
        maxHealth: MAX_HEALTH,
        color: botData[i].color,
        name: botData[i].name,
        lastAttack: 0,
        trophies: Math.floor(Math.random() * 500) + 100,
        rank: i + 2,
      });
    }
    return bots;
  }, []);

  const startLoading = useCallback(() => {
    setGameState(prev => ({ ...prev, gameStatus: 'loading' }));
    setLoadingCountdown(3);
    const interval = setInterval(() => {
      setLoadingCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          startGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startGame = useCallback(() => {
    setGameState({
      player: { id: 'player', x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, health: MAX_HEALTH, maxHealth: MAX_HEALTH, color: '#9B59B6', name: 'Player', lastAttack: 0, trophies: 0, rank: 1 },
      bots: initializeBots(),
      bullets: [],
      poisonRadius: Math.min(MAP_WIDTH, MAP_HEIGHT) / 2 - 20,
      gameStatus: 'playing',
      aliveCount: 10,
      matchTime: 120,
      powerCubes: 0,
    });
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.matchTime <= 0 || prev.gameStatus !== 'playing') {
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
        return { ...prev, matchTime: prev.matchTime - 1, poisonRadius: Math.max(30, prev.poisonRadius - 0.5) };
      });
    }, 1000);
  }, [initializeBots]);

  const shootBullets = useCallback((shooter: Character, dx: number, dy: number): Bullet[] => {
    const now = Date.now();
    if (now - shooter.lastAttack < ATTACK_COOLDOWN) return [];
    const bullets: Bullet[] = [];
    const baseAngle = Math.atan2(dy, dx);
    for (let i = 0; i < 5; i++) {
      const angleOffset = (i - 2) * 0.1;
      const angle = baseAngle + angleOffset;
      bullets.push({ id: `bullet-${shooter.id}-${now}-${i}`, x: shooter.x, y: shooter.y, dx: Math.cos(angle) * BULLET_SPEED, dy: Math.sin(angle) * BULLET_SPEED, ownerId: shooter.id });
    }
    return bullets;
  }, []);

  const updateBotAI = useCallback((bot: Character, player: Character): { bot: Character; newBullets: Bullet[] } => {
    const now = Date.now();
    let newBot = { ...bot };
    let newBullets: Bullet[] = [];
    const distToPlayer = Math.sqrt((player.x - bot.x) ** 2 + (player.y - bot.y) ** 2);
    let moveX = 0, moveY = 0;
    if (distToPlayer > 120) { moveX = (player.x - bot.x) / distToPlayer; moveY = (player.y - bot.y) / distToPlayer; }
    else if (distToPlayer < 60) { moveX = -(player.x - bot.x) / distToPlayer; moveY = -(player.y - bot.y) / distToPlayer; }
    else { const a = Math.random() * Math.PI * 2; moveX = Math.cos(a); moveY = Math.sin(a); }
    moveX += (Math.random() - 0.5) * 0.3; moveY += (Math.random() - 0.5) * 0.3;
    const m = Math.sqrt(moveX ** 2 + moveY ** 2);
    if (m > 0) { newBot.x += (moveX / m) * BOT_SPEED; newBot.y += (moveY / m) * BOT_SPEED; }
    newBot.x = Math.max(40, Math.min(MAP_WIDTH - 40, newBot.x));
    newBot.y = Math.max(40, Math.min(MAP_HEIGHT - 40, newBot.y));
    if (distToPlayer < 150 && now - bot.lastAttack > ATTACK_COOLDOWN + Math.random() * 300) {
      const aimDx = (player.x - bot.x) / distToPlayer + (Math.random() - 0.5) * 0.15;
      const aimDy = (player.y - bot.y) / distToPlayer + (Math.random() - 0.5) * 0.15;
      const baseAngle = Math.atan2(aimDy, aimDx);
      for (let i = 0; i < 3; i++) {
        const angle = baseAngle + (i - 1) * 0.15;
        newBullets.push({ id: `bullet-${bot.id}-${now}-${i}`, x: bot.x, y: bot.y, dx: Math.cos(angle) * BULLET_SPEED * 0.7, dy: Math.sin(angle) * BULLET_SPEED * 0.7, ownerId: bot.id });
      }
      newBot.lastAttack = now;
    }
    return { bot: newBot, newBullets };
  }, []);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;
    const gameLoop = () => {
      setGameState((prev) => {
        if (prev.gameStatus !== 'playing') return prev;
        const now = Date.now();
        let newPlayer = { ...prev.player };
        newPlayer.x += moveDirection.current.dx * PLAYER_SPEED;
        newPlayer.y += moveDirection.current.dy * PLAYER_SPEED;
        newPlayer.x = Math.max(40, Math.min(MAP_WIDTH - 40, newPlayer.x));
        newPlayer.y = Math.max(40, Math.min(MAP_HEIGHT - 40, newPlayer.y));
        let newBullets = [...prev.bullets];
        if (isAttacking.current && (attackDirection.current.dx !== 0 || attackDirection.current.dy !== 0)) {
          const pb = shootBullets(newPlayer, attackDirection.current.dx, attackDirection.current.dy);
          if (pb.length > 0) { newBullets.push(...pb); newPlayer.lastAttack = now; }
        }
        let newBots = prev.bots.filter(b => b.health > 0).map(bot => {
          const { bot: ub, newBullets: bb } = updateBotAI(bot, newPlayer);
          newBullets.push(...bb);
          return ub;
        });
        newBullets = newBullets.map(b => ({ ...b, x: b.x + b.dx, y: b.y + b.dy })).filter(b => b.x > 0 && b.x < MAP_WIDTH && b.y > 0 && b.y < MAP_HEIGHT);
        newBullets = newBullets.filter(bullet => {
          if (bullet.ownerId !== 'player') {
            const d = Math.sqrt((bullet.x - newPlayer.x) ** 2 + (bullet.y - newPlayer.y) ** 2);
            if (d < PLAYER_SIZE / 2 + BULLET_SIZE) { newPlayer.health -= SHELLY_DAMAGE; return false; }
          }
          for (let i = 0; i < newBots.length; i++) {
            if (bullet.ownerId !== newBots[i].id) {
              const d = Math.sqrt((bullet.x - newBots[i].x) ** 2 + (bullet.y - newBots[i].y) ** 2);
              if (d < PLAYER_SIZE / 2 + BULLET_SIZE) { newBots[i] = { ...newBots[i], health: newBots[i].health - SHELLY_DAMAGE }; return false; }
            }
          }
          return true;
        });
        newBots = newBots.filter(b => b.health > 0);
        const cx = MAP_WIDTH / 2, cy = MAP_HEIGHT / 2;
        const pd = Math.sqrt((newPlayer.x - cx) ** 2 + (newPlayer.y - cy) ** 2);
        if (pd > prev.poisonRadius) newPlayer.health -= POISON_DAMAGE * 0.05;
        newBots = newBots.map(b => {
          const bd = Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2);
          return bd > prev.poisonRadius ? { ...b, health: b.health - POISON_DAMAGE * 0.05 } : b;
        }).filter(b => b.health > 0);
        const aliveCount = 1 + newBots.length;
        let gameStatus: GameState['gameStatus'] = 'playing';
        if (newPlayer.health <= 0) { gameStatus = 'lost'; if (timerRef.current) clearInterval(timerRef.current); }
        else if (newBots.length === 0) { gameStatus = 'won'; if (timerRef.current) clearInterval(timerRef.current); }
        return { ...prev, player: newPlayer, bots: newBots, bullets: newBullets, gameStatus, aliveCount };
      });
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };
    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [gameState.gameStatus, shootBullets, updateBotAI]);

  const handleMove = useCallback((dx: number, dy: number) => { moveDirection.current = { dx, dy }; }, []);
  const handleMoveRelease = useCallback(() => { moveDirection.current = { dx: 0, dy: 0 }; }, []);
  const handleAttack = useCallback((dx: number, dy: number) => { attackDirection.current = { dx, dy }; isAttacking.current = true; }, []);
  const handleAttackRelease = useCallback(() => { attackDirection.current = { dx: 0, dy: 0 }; isAttacking.current = false; }, []);

  // ==================== RENDER: MAIN MENU ====================
  if (gameState.gameStatus === 'menu') {
    return (
      <View style={styles.menuContainer}>
        {/* Cyan/Teal gradient background */}
        <View style={styles.menuBackground}>
          {/* Decorative lines */}
          <View style={styles.bgLine1} />
          <View style={styles.bgLine2} />
          <View style={styles.bgLine3} />
        </View>

        {/* TOP BAR */}
        <View style={styles.topBar}>
          {/* Player Profile */}
          <View style={styles.profileBox}>
            <View style={styles.avatarBox}>
              <ShellyCharacter size={35} showTrophies={false} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Player</Text>
              <View style={styles.profileTrophyRow}>
                <FontAwesome5 name="trophy" size={11} color="#F1C40F" />
                <Text style={styles.profileTrophyText}>0</Text>
              </View>
            </View>
          </View>

          {/* Friend icons in top */}
          <View style={styles.friendsRow}>
            {[...Array(5)].map((_, i) => (
              <View key={i} style={styles.friendIcon}>
                <Ionicons name="person" size={14} color="#888" />
                <Text style={styles.friendStatus}>0</Text>
              </View>
            ))}
          </View>

          {/* Right icons */}
          <View style={styles.topRightIcons}>
            <TouchableOpacity style={styles.chatBtn}>
              <Text style={styles.chatText}>CHAT</Text>
              <Text style={styles.loginText}>LOG IN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuIconBtn}>
              <Ionicons name="menu" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* MAIN CONTENT */}
        <View style={styles.mainContent}>
          {/* LEFT SIDEBAR */}
          <View style={styles.leftSidebar}>
            <View style={styles.allGamesTab}>
              <Text style={styles.allGamesText}>All Games</Text>
            </View>
            
            <TouchableOpacity style={styles.shopBtn}>
              <MaterialCommunityIcons name="store" size={20} color="#fff" />
              <Text style={styles.shopText}>SHOP</Text>
            </TouchableOpacity>

            <View style={styles.timerBox}>
              <Text style={styles.timerTitle}>0:00</Text>
              <View style={styles.timerProgress}>
                <Text style={styles.timerProgressText}>0/5</Text>
              </View>
            </View>

            <View style={styles.levelBox}>
              <View style={styles.levelCircle}>
                <Text style={styles.levelNumber}>1</Text>
              </View>
              <View style={styles.levelProgress}>
                <Text style={styles.levelProgressText}>0/110</Text>
              </View>
            </View>

            <View style={styles.sidebarIcons}>
              <TouchableOpacity style={[styles.sideIcon, { backgroundColor: '#F39C12' }]}>
                <MaterialCommunityIcons name="gamepad-variant" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sideIcon, { backgroundColor: '#E74C3C' }]}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sideIcon}>
                <Ionicons name="stats-chart" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* CENTER - Characters */}
          <View style={styles.centerContent}>
            {/* Floating emotes */}
            <View style={styles.floatingEmotes}>
              <View style={[styles.emoteCircle, { top: 10, left: '30%' }]}>
                <Text style={styles.emoteIcon}>😊</Text>
              </View>
              <View style={[styles.emoteCircle, { top: 30, right: '35%' }]}>
                <Ionicons name="skull" size={16} color="#333" />
              </View>
              <View style={[styles.emoteCircle, { top: 5, right: '25%' }]}>
                <MaterialCommunityIcons name="star" size={16} color="#F1C40F" />
              </View>
            </View>

            {/* Characters */}
            <View style={styles.charactersRow}>
              <ShellyCharacter size={100} showTrophies={true} trophies={0} />
              <View style={{ width: 20 }} />
              <ShellyCharacter size={100} showTrophies={true} trophies={0} />
            </View>

            {/* Favorite tag */}
            <View style={styles.favoriteTag}>
              <Ionicons name="heart" size={12} color="#E91E63" />
              <Text style={styles.favoriteText}>FAVORITE</Text>
            </View>

            {/* Choose button */}
            <TouchableOpacity style={styles.chooseBtn}>
              <Text style={styles.chooseText}>CHOOSE</Text>
            </TouchableOpacity>
          </View>

          {/* RIGHT SIDEBAR */}
          <View style={styles.rightSidebar}>
            <TouchableOpacity style={styles.topBtn}>
              <FontAwesome5 name="trophy" size={18} color="#3498DB" />
              <Text style={styles.topBtnText}>TOP</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.clubBtn}>
              <Text style={styles.clubTrophies}>1000</Text>
              <Text style={styles.clubText}>CLUB</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mapMakerBtn}>
              <Text style={styles.newTag}>NEW!</Text>
              <MaterialCommunityIcons name="map" size={18} color="#fff" />
              <Text style={styles.mapMakerText}>MAP MAKER</Text>
            </TouchableOpacity>

            {/* Daily Wins */}
            <View style={styles.dailyWinsBox}>
              <Text style={styles.dailyWinsTitle}>DAILY WINS!</Text>
              <View style={styles.dailyWinsIcons}>
                {['#F1C40F', '#2ECC71', '#E74C3C', '#3498DB', '#9B59B6'].map((c, i) => (
                  <View key={i} style={[styles.dailyWinIcon, { backgroundColor: c }]}>
                    <MaterialCommunityIcons name="star" size={12} color="#fff" />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* BOTTOM BAR */}
        <View style={styles.bottomBar}>
          {/* Starr Pass */}
          <View style={styles.starrPassBox}>
            <Text style={styles.starrPassTitle}>STARR PASS</Text>
            <View style={styles.xpBar}>
              <Text style={styles.xpText}>XP</Text>
              <View style={styles.xpProgress}>
                <View style={styles.xpFill} />
              </View>
              <Text style={styles.xpValue}>0/150</Text>
              <View style={styles.xpBadge}>
                <Text style={styles.xpBadgeText}>2</Text>
              </View>
            </View>
            <View style={styles.starrPassIcons}>
              <BrawlerIcon color="#F39C12" size={35} />
              <BrawlerIcon color="#E91E63" size={35} />
            </View>
          </View>

          {/* Mode Selection & Play Button */}
          <View style={styles.playSection}>
            {/* Showdown Mode */}
            <TouchableOpacity style={styles.modeSelector}>
              <View style={styles.modeIcon}>
                <Ionicons name="skull" size={24} color="#fff" />
              </View>
              <View style={styles.modeInfo}>
                <View style={styles.modeTimer}>
                  <Text style={styles.modeTimerText}>? 5:04</Text>
                </View>
                <Text style={styles.modeName}>SHOWDOWN</Text>
                <View style={styles.modeTrophyReq}>
                  <View style={styles.greenDot} />
                </View>
              </View>
            </TouchableOpacity>

            {/* PLAY Button */}
            <TouchableOpacity style={styles.playButton} onPress={startLoading}>
              <Text style={styles.playButtonText}>PLAY</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ==================== RENDER: LOADING ====================
  if (gameState.gameStatus === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingTitle}>SHOWDOWN</Text>
        <Text style={styles.loadingSubtitle}>Every Brawler for themselves!</Text>
        <View style={styles.playersGrid}>
          {[...Array(10)].map((_, i) => (
            <View key={i} style={styles.playerCard}>
              <View style={[styles.playerCardBg, { backgroundColor: ['#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6', '#1ABC9C', '#E91E63', '#FF6347', '#00CED1', '#8B4513'][i] }]}>
                <BrawlerIcon color="transparent" size={40} />
              </View>
              <Text style={styles.playerCardName}>{['Player', 'Bull', 'Colt', 'Nita', 'Jessie', 'Brock', 'Spike', 'Crow', 'Poco', 'Primo'][i]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.countdownText}>Match starts in: {loadingCountdown}</Text>
      </View>
    );
  }

  // ==================== RENDER: GAME OVER ====================
  if (gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') {
    return (
      <View style={[styles.gameOverContainer, gameState.gameStatus === 'won' ? styles.wonBg : styles.lostBg]}>
        <View style={styles.gameOverContent}>
          {gameState.gameStatus === 'won' ? (
            <>
              <FontAwesome5 name="trophy" size={80} color="#F1C40F" />
              <Text style={styles.gameOverTitle}>#1 VICTORY!</Text>
              <Text style={styles.gameOverSubtitle}>+8 Trophies</Text>
            </>
          ) : (
            <>
              <Ionicons name="skull" size={80} color="#E74C3C" />
              <Text style={styles.gameOverTitle}>DEFEATED</Text>
              <Text style={styles.gameOverSubtitle}>#{gameState.aliveCount + 1} Place</Text>
            </>
          )}
          <TouchableOpacity style={styles.playAgainBtn} onPress={startLoading}>
            <Text style={styles.playAgainText}>PLAY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setGameState(prev => ({ ...prev, gameStatus: 'menu' }))}>
            <Text style={styles.menuBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==================== RENDER: GAMEPLAY ====================
  return (
    <View style={styles.gameContainer}>
      <View style={styles.gameHud}>
        <View style={styles.hudTimer}>
          <Ionicons name="skull" size={18} color="#fff" />
          <Text style={styles.hudTimerText}>:{gameState.matchTime}</Text>
        </View>
        <View style={styles.hudAlive}>
          <Text style={styles.hudAliveText}>{gameState.aliveCount}</Text>
          <Ionicons name="people" size={16} color="#fff" />
        </View>
      </View>

      <View style={styles.mapContainer}>
        <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
          {mapData.map((row, y) => row.map((tile, x) => {
            const tx = x * TILE_SIZE, ty = y * TILE_SIZE;
            if (tile === 'water') return <Rect key={`${x}-${y}`} x={tx} y={ty} width={TILE_SIZE} height={TILE_SIZE} fill="#1E90FF" />;
            if (tile === 'wall') return <G key={`${x}-${y}`}><Rect x={tx} y={ty} width={TILE_SIZE} height={TILE_SIZE} fill="#8B4513" /><Rect x={tx + 2} y={ty + 2} width={TILE_SIZE - 4} height={TILE_SIZE - 4} fill="#A0522D" /></G>;
            if (tile === 'bush') return <G key={`${x}-${y}`}><Rect x={tx} y={ty} width={TILE_SIZE} height={TILE_SIZE} fill="#228B22" /><Circle cx={tx + 16} cy={ty + 16} r={12} fill="#32CD32" /></G>;
            return <Rect key={`${x}-${y}`} x={tx} y={ty} width={TILE_SIZE} height={TILE_SIZE} fill="#C4A574" />;
          }))}
          <Circle cx={MAP_WIDTH / 2} cy={MAP_HEIGHT / 2} r={gameState.poisonRadius} fill="none" stroke="#800080" strokeWidth={4} strokeDasharray="8,4" opacity={0.8} />
          {gameState.bullets.map(b => <Circle key={b.id} cx={b.x} cy={b.y} r={BULLET_SIZE} fill={b.ownerId === 'player' ? '#FFA500' : '#FF0000'} />)}
          {gameState.bots.map(bot => (
            <G key={bot.id}>
              <Circle cx={bot.x} cy={bot.y} r={16} fill={bot.color} />
              <Circle cx={bot.x} cy={bot.y - 2} r={12} fill="#FDBF6F" />
              <Circle cx={bot.x - 4} cy={bot.y - 4} r={3} fill="white" />
              <Circle cx={bot.x + 4} cy={bot.y - 4} r={3} fill="white" />
              <Circle cx={bot.x - 4} cy={bot.y - 4} r={1.5} fill="#E74C3C" />
              <Circle cx={bot.x + 4} cy={bot.y - 4} r={1.5} fill="#E74C3C" />
              <Rect x={bot.x - 20} y={bot.y - 28} width={40} height={6} fill="#333" rx={3} />
              <Rect x={bot.x - 19} y={bot.y - 27} width={38 * (bot.health / bot.maxHealth)} height={4} fill="#E74C3C" rx={2} />
            </G>
          ))}
          <G>
            <Circle cx={gameState.player.x} cy={gameState.player.y} r={18} fill="#9B59B6" />
            <Circle cx={gameState.player.x - 10} cy={gameState.player.y - 15} r={10} fill="#E91E63" />
            <Circle cx={gameState.player.x + 10} cy={gameState.player.y - 15} r={10} fill="#E91E63" />
            <Circle cx={gameState.player.x} cy={gameState.player.y - 2} r={14} fill="#FDBF6F" />
            <Rect x={gameState.player.x - 16} y={gameState.player.y - 8} width={32} height={5} fill="#F1C40F" rx={2} />
            <Circle cx={gameState.player.x - 5} cy={gameState.player.y - 2} r={4} fill="white" />
            <Circle cx={gameState.player.x + 5} cy={gameState.player.y - 2} r={4} fill="white" />
            <Circle cx={gameState.player.x - 5} cy={gameState.player.y - 1} r={2} fill="#333" />
            <Circle cx={gameState.player.x + 5} cy={gameState.player.y - 1} r={2} fill="#333" />
            <Rect x={gameState.player.x - 25} y={gameState.player.y - 35} width={50} height={8} fill="#333" rx={4} />
            <Rect x={gameState.player.x - 24} y={gameState.player.y - 34} width={48 * (gameState.player.health / gameState.player.maxHealth)} height={6} fill="#2ECC71" rx={3} />
            <Rect x={gameState.player.x - 20} y={gameState.player.y - 47} width={40} height={12} fill="#2ECC71" rx={3} />
          </G>
        </Svg>
      </View>

      <View style={styles.emotesPanel}>
        {['😀', '😠', '😢', '👍'].map((e, i) => <TouchableOpacity key={i} style={styles.emoteBtn}><Text style={styles.emoteText}>{e}</Text></TouchableOpacity>)}
      </View>

      <View style={styles.controlsArea}>
        <BrawlJoystick type="move" onMove={handleMove} onRelease={handleMoveRelease} />
        <View style={styles.rightControls}>
          <TouchableOpacity style={styles.superBtn}>
            <MaterialCommunityIcons name="star-four-points" size={32} color="#F1C40F" />
          </TouchableOpacity>
          <BrawlJoystick type="attack" onMove={handleAttack} onRelease={handleAttackRelease} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ===== MENU STYLES =====
  menuContainer: { flex: 1, backgroundColor: '#0A3D4C' },
  menuBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0D5C6E' },
  bgLine1: { position: 'absolute', top: '20%', left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,255,255,0.1)', transform: [{ skewY: '-5deg' }] },
  bgLine2: { position: 'absolute', top: '40%', left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,255,255,0.08)', transform: [{ skewY: '3deg' }] },
  bgLine3: { position: 'absolute', top: '60%', left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,255,255,0.05)', transform: [{ skewY: '-2deg' }] },
  
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingTop: Platform.OS === 'ios' ? 50 : 10, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.3)' },
  profileBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A4A5C', borderRadius: 25, paddingRight: 15, paddingLeft: 5, paddingVertical: 5 },
  avatarBox: { width: 45, height: 45, borderRadius: 22, backgroundColor: '#9B59B6', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  profileInfo: { marginLeft: 8 },
  profileName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  profileTrophyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  profileTrophyText: { color: '#F1C40F', fontSize: 12, marginLeft: 4, fontWeight: 'bold' },
  friendsRow: { flexDirection: 'row', justifyContent: 'center', flex: 1 },
  friendIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1A4A5C', justifyContent: 'center', alignItems: 'center', marginHorizontal: 3 },
  friendStatus: { position: 'absolute', bottom: -2, fontSize: 8, color: '#888' },
  topRightIcons: { flexDirection: 'row', alignItems: 'center' },
  chatBtn: { backgroundColor: '#1A4A5C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 10, alignItems: 'center' },
  chatText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  loginText: { color: '#888', fontSize: 8 },
  menuIconBtn: { padding: 5 },

  mainContent: { flex: 1, flexDirection: 'row', paddingTop: 10 },
  
  leftSidebar: { width: 70, alignItems: 'center', paddingTop: 10 },
  allGamesTab: { backgroundColor: '#333', paddingVertical: 30, paddingHorizontal: 5, borderTopRightRadius: 10, borderBottomRightRadius: 10, marginBottom: 15, transform: [{ rotate: '-90deg' }], width: 80 },
  allGamesText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  shopBtn: { backgroundColor: '#2ECC71', width: 55, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  shopText: { color: '#fff', fontSize: 9, fontWeight: 'bold', marginTop: 2 },
  timerBox: { backgroundColor: '#F1C40F', width: 50, borderRadius: 8, padding: 5, alignItems: 'center', marginBottom: 10 },
  timerTitle: { color: '#333', fontSize: 12, fontWeight: 'bold' },
  timerProgress: { backgroundColor: '#333', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  timerProgressText: { color: '#fff', fontSize: 9 },
  levelBox: { alignItems: 'center', marginBottom: 15 },
  levelCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#F1C40F' },
  levelNumber: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  levelProgress: { backgroundColor: '#333', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginTop: 5 },
  levelProgressText: { color: '#fff', fontSize: 8 },
  sidebarIcons: { marginTop: 10 },
  sideIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A4A5C', justifyContent: 'center', alignItems: 'center', marginVertical: 5 },

  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  floatingEmotes: { position: 'absolute', top: 0, left: 0, right: 0, height: 60 },
  emoteCircle: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  emoteIcon: { fontSize: 14 },
  charactersRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  trophyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 5 },
  trophyBadgeText: { color: '#F1C40F', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  favoriteTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(233, 30, 99, 0.3)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15, marginTop: 5 },
  favoriteText: { color: '#E91E63', fontSize: 11, fontWeight: 'bold', marginLeft: 5 },
  chooseBtn: { backgroundColor: '#1A4A5C', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 20, marginTop: 15, borderWidth: 2, borderColor: '#3498DB' },
  chooseText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  rightSidebar: { width: 80, alignItems: 'center', paddingTop: 10 },
  topBtn: { backgroundColor: '#1A4A5C', width: 60, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: '#3498DB' },
  topBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  clubBtn: { backgroundColor: '#2ECC71', width: 60, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  clubTrophies: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  clubText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  mapMakerBtn: { backgroundColor: '#1A4A5C', width: 65, borderRadius: 10, padding: 8, alignItems: 'center', marginBottom: 10 },
  newTag: { color: '#2ECC71', fontSize: 8, fontWeight: 'bold', marginBottom: 3 },
  mapMakerText: { color: '#fff', fontSize: 8, fontWeight: 'bold', marginTop: 3, textAlign: 'center' },
  dailyWinsBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 8, alignItems: 'center' },
  dailyWinsTitle: { color: '#F1C40F', fontSize: 9, fontWeight: 'bold', marginBottom: 5 },
  dailyWinsIcons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dailyWinIcon: { width: 22, height: 22, borderRadius: 5, justifyContent: 'center', alignItems: 'center', margin: 2 },

  bottomBar: { flexDirection: 'row', paddingHorizontal: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 15, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.4)' },
  starrPassBox: { flex: 1 },
  starrPassTitle: { color: '#2ECC71', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  xpBar: { flexDirection: 'row', alignItems: 'center' },
  xpText: { color: '#F1C40F', fontSize: 10, fontWeight: 'bold', marginRight: 5 },
  xpProgress: { flex: 1, height: 12, backgroundColor: '#333', borderRadius: 6, overflow: 'hidden' },
  xpFill: { width: '0%', height: '100%', backgroundColor: '#F1C40F' },
  xpValue: { color: '#fff', fontSize: 10, marginLeft: 5 },
  xpBadge: { backgroundColor: '#E74C3C', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 5 },
  xpBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  starrPassIcons: { flexDirection: 'row', marginTop: 8 },
  brawlerIcon: { borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 5 },

  playSection: { flexDirection: 'row', alignItems: 'center', marginLeft: 15 },
  modeSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', borderRadius: 10, padding: 8, marginRight: 10 },
  modeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E74C3C', justifyContent: 'center', alignItems: 'center' },
  modeInfo: { marginLeft: 10 },
  modeTimer: { flexDirection: 'row', alignItems: 'center' },
  modeTimerText: { color: '#888', fontSize: 10 },
  modeName: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  modeTrophyReq: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71' },
  playButton: { backgroundColor: '#F1C40F', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, elevation: 5 },
  playButtonText: { color: '#000', fontSize: 22, fontWeight: 'bold' },

  // ===== LOADING STYLES =====
  loadingContainer: { flex: 1, backgroundColor: '#1B263B', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingTitle: { color: '#E74C3C', fontSize: 32, fontWeight: 'bold' },
  loadingSubtitle: { color: '#fff', fontSize: 16, marginTop: 5, marginBottom: 30 },
  playersGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  playerCard: { width: 60, alignItems: 'center' },
  playerCardBg: { width: 50, height: 60, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  playerCardName: { color: '#fff', fontSize: 9, marginTop: 3 },
  countdownText: { color: '#F1C40F', fontSize: 24, fontWeight: 'bold', marginTop: 30 },

  // ===== GAME OVER STYLES =====
  gameOverContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wonBg: { backgroundColor: '#1a3a1a' },
  lostBg: { backgroundColor: '#3a1a1a' },
  gameOverContent: { alignItems: 'center' },
  gameOverTitle: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginTop: 20 },
  gameOverSubtitle: { color: '#aaa', fontSize: 18, marginTop: 10 },
  playAgainBtn: { backgroundColor: '#2ECC71', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 25, marginTop: 40 },
  playAgainText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  menuBtn: { backgroundColor: '#3498DB', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 25, marginTop: 15 },
  menuBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // ===== GAMEPLAY STYLES =====
  gameContainer: { flex: 1, backgroundColor: '#1B263B' },
  gameHud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  hudTimer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E74C3C', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15 },
  hudTimerText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 5 },
  hudAlive: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15 },
  hudAliveText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginRight: 5 },
  mapContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emotesPanel: { position: 'absolute', right: 10, top: '30%', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  emoteBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginVertical: 3 },
  emoteText: { fontSize: 22 },
  controlsArea: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 25 : 15, height: 150 },
  rightControls: { alignItems: 'center' },
  superBtn: { width: 50, height: 50, backgroundColor: '#333', borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 3, borderColor: '#F1C40F' },
  joystickWrapper: { alignItems: 'center', justifyContent: 'center' },
  joystickOuter: { borderRadius: 100, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  joystickBase: { borderRadius: 100, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  joystickKnob: { borderRadius: 100, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  crosshair: { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  crosshairLine: { position: 'absolute', backgroundColor: '#fff' },
  crosshairH: { width: 20, height: 3 },
  crosshairV: { width: 3, height: 20 },
});
