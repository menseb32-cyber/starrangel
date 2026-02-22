import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Platform,
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Path, Defs, LinearGradient, RadialGradient, Stop, G, Ellipse, Polygon } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

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

// Brawler Data
const BRAWLERS = [
  { name: 'Shelly', color: '#9B59B6', hair: '#E91E63' },
  { name: 'Colt', color: '#3498DB', hair: '#8B4513' },
  { name: 'Bull', color: '#E74C3C', hair: '#333' },
  { name: 'Brock', color: '#F39C12', hair: '#333' },
  { name: 'Nita', color: '#1ABC9C', hair: '#8B4513' },
  { name: 'Jessie', color: '#E74C3C', hair: '#FF6B35' },
  { name: 'Spike', color: '#2ECC71', hair: '#2ECC71' },
  { name: 'Crow', color: '#333', hair: '#333' },
];

// Joystick Component - Brawl Stars Style
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
      onPanResponderGrant: () => {
        setIsActive(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const distance = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);
        const angle = Math.atan2(gestureState.dy, gestureState.dx);
        
        const clampedDistance = Math.min(distance, maxDistance);
        const newX = Math.cos(angle) * clampedDistance;
        const newY = Math.sin(angle) * clampedDistance;
        
        setKnobPosition({ x: newX, y: newY });
        
        const normalizedX = newX / maxDistance;
        const normalizedY = newY / maxDistance;
        onMove(normalizedX, normalizedY);
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
      {/* Outer ring */}
      <View style={[
        styles.joystickOuter,
        { 
          width: baseSize + 20, 
          height: baseSize + 20,
          borderColor: isActive ? activeColor : 'rgba(255,255,255,0.3)',
        }
      ]}>
        {/* Base */}
        <View style={[
          styles.joystickBase,
          { 
            width: baseSize, 
            height: baseSize,
            backgroundColor: isActive ? `${baseColor}40` : `${baseColor}20`,
            borderColor: baseColor,
          }
        ]}>
          {/* Knob */}
          <View
            style={[
              styles.joystickKnob,
              {
                width: knobSize,
                height: knobSize,
                backgroundColor: isActive ? activeColor : baseColor,
                transform: [{ translateX: knobPosition.x }, { translateY: knobPosition.y }],
                shadowColor: baseColor,
              },
            ]}
          >
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

// Shelly Character SVG
const ShellySprite = ({ x, y, health, maxHealth, name, isPlayer = false }: any) => {
  const healthPercent = health / maxHealth;
  
  return (
    <G>
      {/* Shadow */}
      <Ellipse cx={x} cy={y + 14} rx={12} ry={5} fill="rgba(0,0,0,0.3)" />
      
      {/* Body */}
      <Circle cx={x} cy={y} r={16} fill="#9B59B6" />
      
      {/* Hair */}
      <Circle cx={x - 8} cy={y - 12} r={8} fill="#E91E63" />
      <Circle cx={x + 8} cy={y - 12} r={8} fill="#E91E63" />
      <Circle cx={x} cy={y - 14} r={10} fill="#E91E63" />
      
      {/* Face */}
      <Circle cx={x} cy={y - 2} r={12} fill="#FDBF6F" />
      
      {/* Eyes */}
      <Circle cx={x - 4} cy={y - 4} r={3} fill="white" />
      <Circle cx={x + 4} cy={y - 4} r={3} fill="white" />
      <Circle cx={x - 4} cy={y - 4} r={1.5} fill="#333" />
      <Circle cx={x + 4} cy={y - 4} r={1.5} fill="#333" />
      
      {/* Mouth */}
      <Path d={`M ${x - 3} ${y + 2} Q ${x} ${y + 5} ${x + 3} ${y + 2}`} stroke="#333" strokeWidth={1.5} fill="none" />
      
      {/* Bandana */}
      <Rect x={x - 10} y={y - 8} width={20} height={4} fill="#F1C40F" rx={2} />
      
      {/* Health bar background */}
      <Rect x={x - 20} y={y - 30} width={40} height={8} fill="#333" rx={4} />
      
      {/* Health bar fill */}
      <Rect 
        x={x - 19} 
        y={y - 29} 
        width={38 * healthPercent} 
        height={6} 
        fill={healthPercent > 0.5 ? '#2ECC71' : healthPercent > 0.25 ? '#F39C12' : '#E74C3C'} 
        rx={3} 
      />
      
      {/* Player name */}
      {isPlayer && (
        <>
          <Rect x={x - 25} y={y - 45} width={50} height={14} fill="#2ECC71" rx={3} />
          <Rect x={x - 24} y={y - 44} width={48} height={12} fill="#1E8449" rx={2} />
        </>
      )}
    </G>
  );
};

// Bot Sprite
const BotSprite = ({ x, y, health, maxHealth, color, name }: any) => {
  const healthPercent = health / maxHealth;
  
  return (
    <G>
      {/* Shadow */}
      <Ellipse cx={x} cy={y + 14} rx={12} ry={5} fill="rgba(0,0,0,0.3)" />
      
      {/* Body */}
      <Circle cx={x} cy={y} r={16} fill={color} />
      
      {/* Face */}
      <Circle cx={x} cy={y - 2} r={12} fill="#FDBF6F" />
      
      {/* Eyes */}
      <Circle cx={x - 4} cy={y - 4} r={3} fill="white" />
      <Circle cx={x + 4} cy={y - 4} r={3} fill="white" />
      <Circle cx={x - 4} cy={y - 4} r={1.5} fill="#E74C3C" />
      <Circle cx={x + 4} cy={y - 4} r={1.5} fill="#E74C3C" />
      
      {/* Angry eyebrows */}
      <Path d={`M ${x - 7} ${y - 8} L ${x - 2} ${y - 6}`} stroke="#333" strokeWidth={2} />
      <Path d={`M ${x + 7} ${y - 8} L ${x + 2} ${y - 6}`} stroke="#333" strokeWidth={2} />
      
      {/* Health bar */}
      <Rect x={x - 20} y={y - 28} width={40} height={6} fill="#333" rx={3} />
      <Rect 
        x={x - 19} 
        y={y - 27} 
        width={38 * healthPercent} 
        height={4} 
        fill={healthPercent > 0.5 ? '#E74C3C' : '#8B0000'} 
        rx={2} 
      />
    </G>
  );
};

// Map Tile
const MapTile = ({ x, y, type }: { x: number; y: number; type: string }) => {
  switch (type) {
    case 'grass':
      return (
        <G>
          <Rect x={x} y={y} width={TILE_SIZE} height={TILE_SIZE} fill="#C4A574" />
          <Circle cx={x + 8} cy={y + 8} r={3} fill="#228B22" />
          <Circle cx={x + 20} cy={y + 12} r={4} fill="#228B22" />
          <Circle cx={x + 12} cy={y + 24} r={3} fill="#228B22" />
        </G>
      );
    case 'bush':
      return (
        <G>
          <Rect x={x} y={y} width={TILE_SIZE} height={TILE_SIZE} fill="#228B22" />
          <Circle cx={x + 16} cy={y + 16} r={14} fill="#2E8B2E" />
          <Circle cx={x + 10} cy={y + 10} r={8} fill="#32CD32" />
          <Circle cx={x + 22} cy={y + 12} r={6} fill="#32CD32" />
        </G>
      );
    case 'wall':
      return (
        <G>
          <Rect x={x} y={y} width={TILE_SIZE} height={TILE_SIZE} fill="#8B4513" />
          <Rect x={x + 2} y={y + 2} width={TILE_SIZE - 4} height={TILE_SIZE - 4} fill="#A0522D" />
          <Rect x={x + 4} y={y + 4} width={12} height={12} fill="#8B4513" rx={2} />
          <Rect x={x + 18} y={y + 18} width={10} height={10} fill="#8B4513" rx={2} />
        </G>
      );
    case 'water':
      return (
        <G>
          <Rect x={x} y={y} width={TILE_SIZE} height={TILE_SIZE} fill="#1E90FF" />
          <Ellipse cx={x + 10} cy={y + 16} rx={6} ry={3} fill="#87CEEB" opacity={0.5} />
          <Ellipse cx={x + 22} cy={y + 10} rx={4} ry={2} fill="#87CEEB" opacity={0.5} />
        </G>
      );
    default:
      return <Rect x={x} y={y} width={TILE_SIZE} height={TILE_SIZE} fill="#C4A574" />;
  }
};

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
      trophies: 1070,
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

  const [selectedBrawler, setSelectedBrawler] = useState(0);
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
        // Border water
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
        x,
        y,
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

  // Start Loading Screen
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

  // Start Game
  const startGame = useCallback(() => {
    setGameState({
      player: {
        id: 'player',
        x: MAP_WIDTH / 2,
        y: MAP_HEIGHT / 2,
        health: MAX_HEALTH,
        maxHealth: MAX_HEALTH,
        color: '#9B59B6',
        name: 'Player',
        lastAttack: 0,
        trophies: 1070,
        rank: 1,
      },
      bots: initializeBots(),
      bullets: [],
      poisonRadius: Math.min(MAP_WIDTH, MAP_HEIGHT) / 2 - 20,
      gameStatus: 'playing',
      aliveCount: 10,
      matchTime: 120,
      powerCubes: 0,
    });

    // Start match timer
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.matchTime <= 0 || prev.gameStatus !== 'playing') {
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
        return {
          ...prev,
          matchTime: prev.matchTime - 1,
          poisonRadius: Math.max(30, prev.poisonRadius - 0.5),
        };
      });
    }, 1000);
  }, [initializeBots]);

  // Shoot bullets (Shelly's attack - shotgun spread)
  const shootBullets = useCallback((shooter: Character, dx: number, dy: number): Bullet[] => {
    const now = Date.now();
    if (now - shooter.lastAttack < ATTACK_COOLDOWN) return [];
    
    const bullets: Bullet[] = [];
    const baseAngle = Math.atan2(dy, dx);
    const spreadAngle = 0.4;
    
    // Shelly shoots 5 bullets in a spread
    for (let i = 0; i < 5; i++) {
      const angleOffset = (i - 2) * spreadAngle * 0.25;
      const angle = baseAngle + angleOffset;
      const speed = BULLET_SPEED * (0.9 + Math.random() * 0.2);
      bullets.push({
        id: `bullet-${shooter.id}-${now}-${i}`,
        x: shooter.x,
        y: shooter.y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        ownerId: shooter.id,
      });
    }
    
    return bullets;
  }, []);

  // Bot AI
  const updateBotAI = useCallback((bot: Character, player: Character): { bot: Character; newBullets: Bullet[] } => {
    const now = Date.now();
    let newBot = { ...bot };
    let newBullets: Bullet[] = [];

    const distToPlayer = Math.sqrt((player.x - bot.x) ** 2 + (player.y - bot.y) ** 2);
    
    let moveX = 0, moveY = 0;

    if (distToPlayer > 120) {
      moveX = (player.x - bot.x) / distToPlayer;
      moveY = (player.y - bot.y) / distToPlayer;
    } else if (distToPlayer < 60) {
      moveX = -(player.x - bot.x) / distToPlayer;
      moveY = -(player.y - bot.y) / distToPlayer;
    } else {
      const strafeAngle = Math.random() * Math.PI * 2;
      moveX = Math.cos(strafeAngle);
      moveY = Math.sin(strafeAngle);
    }

    moveX += (Math.random() - 0.5) * 0.3;
    moveY += (Math.random() - 0.5) * 0.3;

    const moveMag = Math.sqrt(moveX ** 2 + moveY ** 2);
    if (moveMag > 0) {
      newBot.x += (moveX / moveMag) * BOT_SPEED;
      newBot.y += (moveY / moveMag) * BOT_SPEED;
    }

    newBot.x = Math.max(40, Math.min(MAP_WIDTH - 40, newBot.x));
    newBot.y = Math.max(40, Math.min(MAP_HEIGHT - 40, newBot.y));

    if (distToPlayer < 150 && now - bot.lastAttack > ATTACK_COOLDOWN + Math.random() * 300) {
      const aimDx = (player.x - bot.x) / distToPlayer + (Math.random() - 0.5) * 0.15;
      const aimDy = (player.y - bot.y) / distToPlayer + (Math.random() - 0.5) * 0.15;
      
      const baseAngle = Math.atan2(aimDy, aimDx);
      for (let i = 0; i < 3; i++) {
        const angleOffset = (i - 1) * 0.15;
        const angle = baseAngle + angleOffset;
        newBullets.push({
          id: `bullet-${bot.id}-${now}-${i}`,
          x: bot.x,
          y: bot.y,
          dx: Math.cos(angle) * BULLET_SPEED * 0.7,
          dy: Math.sin(angle) * BULLET_SPEED * 0.7,
          ownerId: bot.id,
        });
      }
      newBot.lastAttack = now;
    }

    return { bot: newBot, newBullets };
  }, []);

  // Game Loop
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const gameLoop = () => {
      setGameState((prevState) => {
        if (prevState.gameStatus !== 'playing') return prevState;

        const now = Date.now();
        let newPlayer = { ...prevState.player };
        
        newPlayer.x += moveDirection.current.dx * PLAYER_SPEED;
        newPlayer.y += moveDirection.current.dy * PLAYER_SPEED;
        newPlayer.x = Math.max(40, Math.min(MAP_WIDTH - 40, newPlayer.x));
        newPlayer.y = Math.max(40, Math.min(MAP_HEIGHT - 40, newPlayer.y));

        let newBullets = [...prevState.bullets];
        if (isAttacking.current && (attackDirection.current.dx !== 0 || attackDirection.current.dy !== 0)) {
          const playerBullets = shootBullets(newPlayer, attackDirection.current.dx, attackDirection.current.dy);
          if (playerBullets.length > 0) {
            newBullets.push(...playerBullets);
            newPlayer.lastAttack = now;
          }
        }

        let newBots = prevState.bots.filter(bot => bot.health > 0).map(bot => {
          const { bot: updatedBot, newBullets: botBullets } = updateBotAI(bot, newPlayer);
          newBullets.push(...botBullets);
          return updatedBot;
        });

        newBullets = newBullets
          .map(bullet => ({
            ...bullet,
            x: bullet.x + bullet.dx,
            y: bullet.y + bullet.dy,
          }))
          .filter(bullet => 
            bullet.x > 0 && bullet.x < MAP_WIDTH &&
            bullet.y > 0 && bullet.y < MAP_HEIGHT
          );

        // Collision detection
        newBullets = newBullets.filter(bullet => {
          if (bullet.ownerId !== 'player') {
            const distToPlayer = Math.sqrt((bullet.x - newPlayer.x) ** 2 + (bullet.y - newPlayer.y) ** 2);
            if (distToPlayer < PLAYER_SIZE / 2 + BULLET_SIZE) {
              newPlayer.health -= SHELLY_DAMAGE;
              return false;
            }
          }

          for (let i = 0; i < newBots.length; i++) {
            if (bullet.ownerId !== newBots[i].id) {
              const distToBot = Math.sqrt((bullet.x - newBots[i].x) ** 2 + (bullet.y - newBots[i].y) ** 2);
              if (distToBot < PLAYER_SIZE / 2 + BULLET_SIZE) {
                newBots[i] = { ...newBots[i], health: newBots[i].health - SHELLY_DAMAGE };
                return false;
              }
            }
          }
          return true;
        });

        newBots = newBots.filter(bot => bot.health > 0);

        // Poison damage
        const centerX = MAP_WIDTH / 2;
        const centerY = MAP_HEIGHT / 2;
        const playerDistToCenter = Math.sqrt((newPlayer.x - centerX) ** 2 + (newPlayer.y - centerY) ** 2);
        if (playerDistToCenter > prevState.poisonRadius) {
          newPlayer.health -= POISON_DAMAGE * 0.05;
        }

        newBots = newBots.map(bot => {
          const botDistToCenter = Math.sqrt((bot.x - centerX) ** 2 + (bot.y - centerY) ** 2);
          if (botDistToCenter > prevState.poisonRadius) {
            return { ...bot, health: bot.health - POISON_DAMAGE * 0.05 };
          }
          return bot;
        }).filter(bot => bot.health > 0);

        const aliveCount = 1 + newBots.length;
        let gameStatus: GameState['gameStatus'] = 'playing';
        
        if (newPlayer.health <= 0) {
          gameStatus = 'lost';
          if (timerRef.current) clearInterval(timerRef.current);
        } else if (newBots.length === 0) {
          gameStatus = 'won';
          if (timerRef.current) clearInterval(timerRef.current);
        }

        return {
          ...prevState,
          player: newPlayer,
          bots: newBots,
          bullets: newBullets,
          gameStatus,
          aliveCount,
        };
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState.gameStatus, shootBullets, updateBotAI]);

  const handleMove = useCallback((dx: number, dy: number) => {
    moveDirection.current = { dx, dy };
  }, []);

  const handleMoveRelease = useCallback(() => {
    moveDirection.current = { dx: 0, dy: 0 };
  }, []);

  const handleAttack = useCallback((dx: number, dy: number) => {
    attackDirection.current = { dx, dy };
    isAttacking.current = true;
  }, []);

  const handleAttackRelease = useCallback(() => {
    attackDirection.current = { dx: 0, dy: 0 };
    isAttacking.current = false;
  }, []);

  // RENDER: Main Menu
  if (gameState.gameStatus === 'menu') {
    return (
      <View style={styles.menuContainer}>
        {/* Background gradient */}
        <View style={styles.menuBg}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.playerNameText}>Player</Text>
                <View style={styles.trophyRow}>
                  <FontAwesome5 name="trophy" size={12} color="#F1C40F" />
                  <Text style={styles.trophyText}>{gameState.player.trophies}</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.currencyRow}>
              <View style={styles.currencyItem}>
                <MaterialCommunityIcons name="diamond" size={18} color="#E91E63" />
                <Text style={styles.currencyText}>0</Text>
              </View>
              <View style={styles.currencyItem}>
                <FontAwesome5 name="coins" size={16} color="#F1C40F" />
                <Text style={styles.currencyText}>0</Text>
              </View>
            </View>
          </View>

          {/* Character Display */}
          <View style={styles.characterDisplay}>
            <View style={styles.characterCircle}>
              <Svg width={150} height={150}>
                <Circle cx={75} cy={85} r={50} fill="#9B59B6" />
                <Circle cx={75 - 12} cy={65} r={16} fill="#E91E63" />
                <Circle cx={75 + 12} cy={65} r={16} fill="#E91E63" />
                <Circle cx={75} cy={60} r={20} fill="#E91E63" />
                <Circle cx={75} cy={80} r={28} fill="#FDBF6F" />
                <Circle cx={65} cy={75} r={6} fill="white" />
                <Circle cx={85} cy={75} r={6} fill="white" />
                <Circle cx={65} cy={75} r={3} fill="#333" />
                <Circle cx={85} cy={75} r={3} fill="#333" />
                <Path d={`M 68 90 Q 75 98 82 90`} stroke="#333" strokeWidth={3} fill="none" />
                <Rect x={52} y={70} width={46} height={8} fill="#F1C40F" rx={4} />
              </Svg>
            </View>
            <Text style={styles.brawlerName}>SHELLY</Text>
            <View style={styles.favoriteTag}>
              <Ionicons name="heart" size={12} color="#E91E63" />
              <Text style={styles.favoriteText}>FAVORITE</Text>
            </View>
          </View>

          {/* Mode Selection */}
          <View style={styles.modeSection}>
            <View style={styles.modeCard}>
              <View style={styles.modeIconContainer}>
                <Ionicons name="skull" size={28} color="#fff" />
              </View>
              <Text style={styles.modeText}>SHOWDOWN</Text>
            </View>
          </View>

          {/* Play Button */}
          <TouchableOpacity style={styles.playBtn} onPress={startLoading}>
            <Text style={styles.playBtnText}>PLAY</Text>
          </TouchableOpacity>

          {/* Bottom navigation */}
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem}>
              <MaterialCommunityIcons name="store" size={28} color="#fff" />
              <Text style={styles.navText}>SHOP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
              <Ionicons name="game-controller" size={28} color="#F1C40F" />
              <Text style={[styles.navText, styles.navTextActive]}>BRAWL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem}>
              <Ionicons name="people" size={28} color="#fff" />
              <Text style={styles.navText}>CLUB</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // RENDER: Loading Screen
  if (gameState.gameStatus === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingTitle}>SHOWDOWN</Text>
        <Text style={styles.loadingSubtitle}>Every Brawler for themselves!</Text>
        
        <View style={styles.playersGrid}>
          {[...Array(10)].map((_, i) => (
            <View key={i} style={styles.playerCard}>
              <View style={[styles.playerCardBg, { backgroundColor: i === 0 ? '#2ECC71' : BRAWLERS[i % 8].color }]}>
                <Text style={styles.playerCardRank}>{i + 1}</Text>
              </View>
              <Text style={styles.playerCardName}>{i === 0 ? 'Player' : BRAWLERS[i % 8].name}</Text>
            </View>
          ))}
        </View>
        
        <Text style={styles.countdownText}>Match starts in: {loadingCountdown}</Text>
      </View>
    );
  }

  // RENDER: Game Over
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
          
          <TouchableOpacity 
            style={styles.menuBtn} 
            onPress={() => setGameState(prev => ({ ...prev, gameStatus: 'menu' }))}
          >
            <Text style={styles.menuBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // RENDER: Gameplay
  return (
    <View style={styles.gameContainer}>
      {/* HUD */}
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

      {/* Game Map */}
      <View style={styles.mapContainer}>
        <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
          {/* Map tiles */}
          {mapData.map((row, y) =>
            row.map((tile, x) => (
              <MapTile key={`${x}-${y}`} x={x * TILE_SIZE} y={y * TILE_SIZE} type={tile} />
            ))
          )}

          {/* Poison zone */}
          <Circle
            cx={MAP_WIDTH / 2}
            cy={MAP_HEIGHT / 2}
            r={gameState.poisonRadius}
            fill="none"
            stroke="#800080"
            strokeWidth={4}
            strokeDasharray="8,4"
            opacity={0.8}
          />

          {/* Bullets */}
          {gameState.bullets.map(bullet => (
            <G key={bullet.id}>
              <Circle
                cx={bullet.x}
                cy={bullet.y}
                r={BULLET_SIZE + 2}
                fill={bullet.ownerId === 'player' ? '#FFD700' : '#FF4500'}
                opacity={0.5}
              />
              <Circle
                cx={bullet.x}
                cy={bullet.y}
                r={BULLET_SIZE}
                fill={bullet.ownerId === 'player' ? '#FFA500' : '#FF0000'}
              />
            </G>
          ))}

          {/* Bots */}
          {gameState.bots.map(bot => (
            <BotSprite
              key={bot.id}
              x={bot.x}
              y={bot.y}
              health={bot.health}
              maxHealth={bot.maxHealth}
              color={bot.color}
              name={bot.name}
            />
          ))}

          {/* Player */}
          <ShellySprite
            x={gameState.player.x}
            y={gameState.player.y}
            health={gameState.player.health}
            maxHealth={gameState.player.maxHealth}
            name={gameState.player.name}
            isPlayer={true}
          />
        </Svg>
      </View>

      {/* Emotes Panel */}
      <View style={styles.emotesPanel}>
        {['😀', '😠', '😢', '👍'].map((emoji, i) => (
          <TouchableOpacity key={i} style={styles.emoteBtn}>
            <Text style={styles.emoteText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Controls */}
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
  // Menu Styles
  menuContainer: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },
  menuBg: {
    flex: 1,
    backgroundColor: '#1B263B',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#0D1B2A',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#F1C40F',
  },
  playerNameText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  trophyText: {
    color: '#F1C40F',
    fontSize: 14,
    marginLeft: 5,
    fontWeight: 'bold',
  },
  currencyRow: {
    flexDirection: 'row',
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1B2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginLeft: 10,
  },
  currencyText: {
    color: '#fff',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  characterDisplay: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  characterCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(155, 89, 182, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#9B59B6',
  },
  brawlerName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 15,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  favoriteTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 30, 99, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 10,
  },
  favoriteText: {
    color: '#E91E63',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  modeSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
  },
  modeIconContainer: {
    marginRight: 10,
  },
  modeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playBtn: {
    backgroundColor: '#F1C40F',
    marginHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  playBtnText: {
    color: '#000',
    fontSize: 26,
    fontWeight: 'bold',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    backgroundColor: '#0D1B2A',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    alignItems: 'center',
  },
  navItemActive: {
    transform: [{ scale: 1.1 }],
  },
  navText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
  },
  navTextActive: {
    color: '#F1C40F',
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1B263B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingTitle: {
    color: '#E74C3C',
    fontSize: 32,
    fontWeight: 'bold',
  },
  loadingSubtitle: {
    color: '#fff',
    fontSize: 16,
    marginTop: 5,
    marginBottom: 30,
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  playerCard: {
    width: 65,
    alignItems: 'center',
  },
  playerCardBg: {
    width: 55,
    height: 65,
    borderRadius: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 5,
  },
  playerCardRank: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  playerCardName: {
    color: '#fff',
    fontSize: 10,
    marginTop: 3,
  },
  countdownText: {
    color: '#F1C40F',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 30,
  },

  // Game Over Styles
  gameOverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wonBg: {
    backgroundColor: '#1a3a1a',
  },
  lostBg: {
    backgroundColor: '#3a1a1a',
  },
  gameOverContent: {
    alignItems: 'center',
  },
  gameOverTitle: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 20,
  },
  gameOverSubtitle: {
    color: '#aaa',
    fontSize: 18,
    marginTop: 10,
  },
  playAgainBtn: {
    backgroundColor: '#2ECC71',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 40,
  },
  playAgainText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuBtn: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 15,
  },
  menuBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Gameplay Styles
  gameContainer: {
    flex: 1,
    backgroundColor: '#1B263B',
  },
  gameHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hudTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  hudTimerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  hudAlive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  hudAliveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 5,
  },
  mapContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotesPanel: {
    position: 'absolute',
    right: 10,
    top: '30%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  emoteBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 3,
  },
  emoteText: {
    fontSize: 22,
  },
  controlsArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 25 : 15,
    height: 150,
  },
  rightControls: {
    alignItems: 'center',
  },
  superBtn: {
    width: 50,
    height: 50,
    backgroundColor: '#333',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: '#F1C40F',
  },
  joystickWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  joystickOuter: {
    borderRadius: 100,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joystickBase: {
    borderRadius: 100,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joystickKnob: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  crosshair: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairLine: {
    position: 'absolute',
    backgroundColor: '#fff',
  },
  crosshairH: {
    width: 20,
    height: 3,
  },
  crosshairV: {
    width: 3,
    height: 20,
  },
});
