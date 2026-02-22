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
import Svg, { Circle, Rect, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game Constants
const ARENA_SIZE = Math.min(SCREEN_WIDTH - 20, SCREEN_HEIGHT - 200);
const PLAYER_SIZE = 30;
const BULLET_SIZE = 6;
const BULLET_SPEED = 8;
const PLAYER_SPEED = 3;
const BOT_SPEED = 1.5;
const MAX_HEALTH = 100;
const COLT_DAMAGE = 12;
const ATTACK_COOLDOWN = 500;
const POISON_DAMAGE = 2;
const POISON_TICK = 500;

// Types
interface Position {
  x: number;
  y: number;
}

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
}

interface GameState {
  player: Character;
  bots: Character[];
  bullets: Bullet[];
  poisonRadius: number;
  gameStatus: 'menu' | 'playing' | 'won' | 'lost';
  aliveCount: number;
}

// Joystick Component
const VirtualJoystick = ({
  position,
  onMove,
  onRelease,
  isAttack = false,
}: {
  position: 'left' | 'right';
  onMove: (dx: number, dy: number) => void;
  onRelease: () => void;
  isAttack?: boolean;
}) => {
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const baseSize = 120;
  const knobSize = 50;
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

  return (
    <View
      style={[
        styles.joystickContainer,
        position === 'left' ? styles.joystickLeft : styles.joystickRight,
      ]}
      {...panResponder.panHandlers}
    >
      <View style={[styles.joystickBase, { width: baseSize, height: baseSize }]}>
        <View
          style={[
            styles.joystickKnob,
            {
              width: knobSize,
              height: knobSize,
              transform: [{ translateX: knobPosition.x }, { translateY: knobPosition.y }],
              backgroundColor: isActive 
                ? (isAttack ? '#FF6B6B' : '#4ECDC4') 
                : (isAttack ? '#FF4757' : '#2ED573'),
            },
          ]}
        >
          {isAttack && (
            <Ionicons name="flash" size={24} color="white" />
          )}
        </View>
      </View>
      <Text style={styles.joystickLabel}>
        {isAttack ? 'ANGRIFF' : 'BEWEGEN'}
      </Text>
    </View>
  );
};

// Health Bar Component
const HealthBar = ({ health, maxHealth, x, y, width = 40 }: { 
  health: number; 
  maxHealth: number; 
  x: number; 
  y: number; 
  width?: number;
}) => {
  const healthPercent = Math.max(0, health / maxHealth);
  const barHeight = 6;
  
  return (
    <>
      <Rect
        x={x - width / 2}
        y={y - PLAYER_SIZE / 2 - 12}
        width={width}
        height={barHeight}
        fill="#333"
        rx={3}
      />
      <Rect
        x={x - width / 2}
        y={y - PLAYER_SIZE / 2 - 12}
        width={width * healthPercent}
        height={barHeight}
        fill={healthPercent > 0.5 ? '#2ECC71' : healthPercent > 0.25 ? '#F39C12' : '#E74C3C'}
        rx={3}
      />
    </>
  );
};

// Main Game Component
export default function BrawlStarsGame() {
  const [gameState, setGameState] = useState<GameState>({
    player: {
      id: 'player',
      x: ARENA_SIZE / 2,
      y: ARENA_SIZE / 2,
      health: MAX_HEALTH,
      maxHealth: MAX_HEALTH,
      color: '#3498DB',
      name: 'Colt',
      lastAttack: 0,
    },
    bots: [],
    bullets: [],
    poisonRadius: ARENA_SIZE / 2,
    gameStatus: 'menu',
    aliveCount: 1,
  });

  const moveDirection = useRef({ dx: 0, dy: 0 });
  const attackDirection = useRef({ dx: 0, dy: 0 });
  const isAttacking = useRef(false);
  const gameLoopRef = useRef<number | null>(null);
  const lastPoisonTick = useRef(0);

  // Initialize Bots
  const initializeBots = useCallback(() => {
    const botColors = ['#E74C3C', '#9B59B6', '#F39C12', '#1ABC9C', '#E91E63'];
    const botNames = ['Bull', 'Shelly', 'Nita', 'Jessie', 'Brock'];
    const bots: Character[] = [];
    
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const radius = ARENA_SIZE * 0.35;
      bots.push({
        id: `bot-${i}`,
        x: ARENA_SIZE / 2 + Math.cos(angle) * radius,
        y: ARENA_SIZE / 2 + Math.sin(angle) * radius,
        health: MAX_HEALTH,
        maxHealth: MAX_HEALTH,
        color: botColors[i],
        name: botNames[i],
        lastAttack: 0,
      });
    }
    return bots;
  }, []);

  // Start Game
  const startGame = useCallback(() => {
    setGameState({
      player: {
        id: 'player',
        x: ARENA_SIZE / 2,
        y: ARENA_SIZE / 2,
        health: MAX_HEALTH,
        maxHealth: MAX_HEALTH,
        color: '#3498DB',
        name: 'Colt',
        lastAttack: 0,
      },
      bots: initializeBots(),
      bullets: [],
      poisonRadius: ARENA_SIZE / 2,
      gameStatus: 'playing',
      aliveCount: 6,
    });
    lastPoisonTick.current = Date.now();
  }, [initializeBots]);

  // Shoot bullets (Colt's attack - 6 bullets in a spread)
  const shootBullets = useCallback((shooter: Character, dx: number, dy: number): Bullet[] => {
    const now = Date.now();
    if (now - shooter.lastAttack < ATTACK_COOLDOWN) return [];
    
    const bullets: Bullet[] = [];
    const spreadAngle = 0.15; // Small spread for Colt
    const baseAngle = Math.atan2(dy, dx);
    
    // Colt shoots 6 bullets with slight spread
    for (let i = 0; i < 6; i++) {
      const angleOffset = (i - 2.5) * spreadAngle * 0.3;
      const angle = baseAngle + angleOffset;
      bullets.push({
        id: `bullet-${shooter.id}-${now}-${i}`,
        x: shooter.x,
        y: shooter.y,
        dx: Math.cos(angle) * BULLET_SPEED,
        dy: Math.sin(angle) * BULLET_SPEED,
        ownerId: shooter.id,
      });
    }
    
    return bullets;
  }, []);

  // Bot AI
  const updateBotAI = useCallback((bot: Character, player: Character, allBots: Character[]): { bot: Character; newBullets: Bullet[] } => {
    const now = Date.now();
    let newBot = { ...bot };
    let newBullets: Bullet[] = [];

    // Calculate distance to player
    const distToPlayer = Math.sqrt(
      (player.x - bot.x) ** 2 + (player.y - bot.y) ** 2
    );

    // Move towards player if far, away if too close
    const optimalDistance = 100;
    let moveX = 0;
    let moveY = 0;

    if (distToPlayer > optimalDistance + 50) {
      // Move towards player
      moveX = (player.x - bot.x) / distToPlayer;
      moveY = (player.y - bot.y) / distToPlayer;
    } else if (distToPlayer < optimalDistance - 30) {
      // Move away from player
      moveX = -(player.x - bot.x) / distToPlayer;
      moveY = -(player.y - bot.y) / distToPlayer;
    } else {
      // Strafe randomly
      const strafeAngle = Math.random() * Math.PI * 2;
      moveX = Math.cos(strafeAngle);
      moveY = Math.sin(strafeAngle);
    }

    // Add some randomness
    moveX += (Math.random() - 0.5) * 0.5;
    moveY += (Math.random() - 0.5) * 0.5;

    // Normalize and apply speed
    const moveMag = Math.sqrt(moveX ** 2 + moveY ** 2);
    if (moveMag > 0) {
      newBot.x += (moveX / moveMag) * BOT_SPEED;
      newBot.y += (moveY / moveMag) * BOT_SPEED;
    }

    // Keep bot in arena
    newBot.x = Math.max(PLAYER_SIZE, Math.min(ARENA_SIZE - PLAYER_SIZE, newBot.x));
    newBot.y = Math.max(PLAYER_SIZE, Math.min(ARENA_SIZE - PLAYER_SIZE, newBot.y));

    // Shoot at player if in range and cooldown passed
    if (distToPlayer < 200 && now - bot.lastAttack > ATTACK_COOLDOWN + Math.random() * 500) {
      const aimDx = (player.x - bot.x) / distToPlayer;
      const aimDy = (player.y - bot.y) / distToPlayer;
      
      // Add some inaccuracy
      const inaccuracy = 0.2;
      const finalDx = aimDx + (Math.random() - 0.5) * inaccuracy;
      const finalDy = aimDy + (Math.random() - 0.5) * inaccuracy;
      
      // Bot shoots 3 bullets
      const baseAngle = Math.atan2(finalDy, finalDx);
      for (let i = 0; i < 3; i++) {
        const angleOffset = (i - 1) * 0.1;
        const angle = baseAngle + angleOffset;
        newBullets.push({
          id: `bullet-${bot.id}-${now}-${i}`,
          x: bot.x,
          y: bot.y,
          dx: Math.cos(angle) * BULLET_SPEED * 0.8,
          dy: Math.sin(angle) * BULLET_SPEED * 0.8,
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
        let newState = { ...prevState };

        // Update player position
        let newPlayer = { ...prevState.player };
        newPlayer.x += moveDirection.current.dx * PLAYER_SPEED;
        newPlayer.y += moveDirection.current.dy * PLAYER_SPEED;
        
        // Keep player in arena
        newPlayer.x = Math.max(PLAYER_SIZE, Math.min(ARENA_SIZE - PLAYER_SIZE, newPlayer.x));
        newPlayer.y = Math.max(PLAYER_SIZE, Math.min(ARENA_SIZE - PLAYER_SIZE, newPlayer.y));

        // Player attack
        let newBullets = [...prevState.bullets];
        if (isAttacking.current && (attackDirection.current.dx !== 0 || attackDirection.current.dy !== 0)) {
          const playerBullets = shootBullets(newPlayer, attackDirection.current.dx, attackDirection.current.dy);
          if (playerBullets.length > 0) {
            newBullets.push(...playerBullets);
            newPlayer.lastAttack = now;
          }
        }

        // Update bots
        let newBots = prevState.bots.filter(bot => bot.health > 0).map(bot => {
          const { bot: updatedBot, newBullets: botBullets } = updateBotAI(bot, newPlayer, prevState.bots);
          newBullets.push(...botBullets);
          return updatedBot;
        });

        // Update bullets
        newBullets = newBullets
          .map(bullet => ({
            ...bullet,
            x: bullet.x + bullet.dx,
            y: bullet.y + bullet.dy,
          }))
          .filter(bullet => 
            bullet.x > 0 && bullet.x < ARENA_SIZE &&
            bullet.y > 0 && bullet.y < ARENA_SIZE
          );

        // Bullet collision detection
        newBullets = newBullets.filter(bullet => {
          // Check collision with player
          if (bullet.ownerId !== 'player') {
            const distToPlayer = Math.sqrt(
              (bullet.x - newPlayer.x) ** 2 + (bullet.y - newPlayer.y) ** 2
            );
            if (distToPlayer < PLAYER_SIZE / 2 + BULLET_SIZE) {
              newPlayer.health -= COLT_DAMAGE;
              return false;
            }
          }

          // Check collision with bots
          for (let i = 0; i < newBots.length; i++) {
            if (bullet.ownerId !== newBots[i].id) {
              const distToBot = Math.sqrt(
                (bullet.x - newBots[i].x) ** 2 + (bullet.y - newBots[i].y) ** 2
              );
              if (distToBot < PLAYER_SIZE / 2 + BULLET_SIZE) {
                newBots[i] = { ...newBots[i], health: newBots[i].health - COLT_DAMAGE };
                return false;
              }
            }
          }

          return true;
        });

        // Remove dead bots
        newBots = newBots.filter(bot => bot.health > 0);

        // Poison zone
        let newPoisonRadius = prevState.poisonRadius;
        if (now - lastPoisonTick.current > 3000) { // Shrink every 3 seconds
          newPoisonRadius = Math.max(50, newPoisonRadius - 5);
        }

        // Apply poison damage
        if (now - lastPoisonTick.current > POISON_TICK) {
          const centerX = ARENA_SIZE / 2;
          const centerY = ARENA_SIZE / 2;

          // Player poison
          const playerDistToCenter = Math.sqrt(
            (newPlayer.x - centerX) ** 2 + (newPlayer.y - centerY) ** 2
          );
          if (playerDistToCenter > newPoisonRadius) {
            newPlayer.health -= POISON_DAMAGE;
          }

          // Bots poison
          newBots = newBots.map(bot => {
            const botDistToCenter = Math.sqrt(
              (bot.x - centerX) ** 2 + (bot.y - centerY) ** 2
            );
            if (botDistToCenter > newPoisonRadius) {
              return { ...bot, health: bot.health - POISON_DAMAGE };
            }
            return bot;
          });

          lastPoisonTick.current = now;
        }

        // Check game over conditions
        const aliveCount = 1 + newBots.length;
        let gameStatus: GameState['gameStatus'] = 'playing';
        
        if (newPlayer.health <= 0) {
          gameStatus = 'lost';
        } else if (newBots.length === 0) {
          gameStatus = 'won';
        }

        return {
          ...newState,
          player: newPlayer,
          bots: newBots,
          bullets: newBullets,
          poisonRadius: newPoisonRadius,
          gameStatus,
          aliveCount,
        };
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState.gameStatus, shootBullets, updateBotAI]);

  // Handle movement
  const handleMove = useCallback((dx: number, dy: number) => {
    moveDirection.current = { dx, dy };
  }, []);

  const handleMoveRelease = useCallback(() => {
    moveDirection.current = { dx: 0, dy: 0 };
  }, []);

  // Handle attack
  const handleAttack = useCallback((dx: number, dy: number) => {
    attackDirection.current = { dx, dy };
    isAttacking.current = true;
  }, []);

  const handleAttackRelease = useCallback(() => {
    attackDirection.current = { dx: 0, dy: 0 };
    isAttacking.current = false;
  }, []);

  // Render Menu
  if (gameState.gameStatus === 'menu') {
    return (
      <SafeAreaView style={styles.menuContainer}>
        <View style={styles.menuContent}>
          <Text style={styles.title}>BRAWL STARS</Text>
          <Text style={styles.subtitle}>2D Edition</Text>
          
          <View style={styles.characterPreview}>
            <Svg width={100} height={100}>
              <Circle cx={50} cy={50} r={35} fill="#3498DB" />
              <Circle cx={40} cy={42} r={5} fill="white" />
              <Circle cx={60} cy={42} r={5} fill="white" />
              <Circle cx={40} cy={42} r={2} fill="#333" />
              <Circle cx={60} cy={42} r={2} fill="#333" />
              <Rect x={35} y={60} width={30} height={5} rx={2} fill="#333" />
            </Svg>
            <Text style={styles.characterName}>COLT</Text>
          </View>

          <View style={styles.modeInfo}>
            <Ionicons name="skull" size={24} color="#E74C3C" />
            <Text style={styles.modeName}>SHOWDOWN</Text>
          </View>

          <TouchableOpacity style={styles.playButton} onPress={startGame}>
            <Ionicons name="play" size={32} color="white" />
            <Text style={styles.playButtonText}>SPIELEN</Text>
          </TouchableOpacity>

          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              <Ionicons name="game-controller" size={16} color="#888" /> Links: Bewegen
            </Text>
            <Text style={styles.instructionText}>
              <Ionicons name="flash" size={16} color="#888" /> Rechts: Zielen & Schießen
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Render Game Over
  if (gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') {
    return (
      <SafeAreaView style={[styles.menuContainer, gameState.gameStatus === 'won' ? styles.wonBg : styles.lostBg]}>
        <View style={styles.menuContent}>
          <Ionicons 
            name={gameState.gameStatus === 'won' ? 'trophy' : 'skull'} 
            size={80} 
            color={gameState.gameStatus === 'won' ? '#F1C40F' : '#E74C3C'} 
          />
          <Text style={[styles.title, { marginTop: 20 }]}>
            {gameState.gameStatus === 'won' ? 'SIEG!' : 'NIEDERLAGE'}
          </Text>
          <Text style={styles.subtitle}>
            {gameState.gameStatus === 'won' ? 'Du bist der letzte Überlebende!' : 'Versuche es erneut!'}
          </Text>
          
          <TouchableOpacity style={styles.playButton} onPress={startGame}>
            <Ionicons name="refresh" size={24} color="white" />
            <Text style={styles.playButtonText}>NOCHMAL</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.playButton, styles.menuButton]} 
            onPress={() => setGameState(prev => ({ ...prev, gameStatus: 'menu' }))}
          >
            <Ionicons name="home" size={24} color="white" />
            <Text style={styles.playButtonText}>MENÜ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render Game
  return (
    <SafeAreaView style={styles.gameContainer}>
      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <View style={styles.playerInfo}>
            <View style={[styles.playerIcon, { backgroundColor: gameState.player.color }]} />
            <Text style={styles.playerName}>{gameState.player.name}</Text>
          </View>
          <View style={styles.healthBarContainer}>
            <View style={styles.healthBarBg}>
              <View 
                style={[
                  styles.healthBarFill, 
                  { 
                    width: `${(gameState.player.health / MAX_HEALTH) * 100}%`,
                    backgroundColor: gameState.player.health > 50 ? '#2ECC71' : gameState.player.health > 25 ? '#F39C12' : '#E74C3C'
                  }
                ]} 
              />
            </View>
            <Text style={styles.healthText}>{Math.max(0, Math.round(gameState.player.health))}</Text>
          </View>
        </View>
        
        <View style={styles.hudRight}>
          <Ionicons name="people" size={20} color="#fff" />
          <Text style={styles.aliveText}>{gameState.aliveCount}</Text>
        </View>
      </View>

      {/* Game Arena */}
      <View style={styles.arenaContainer}>
        <Svg width={ARENA_SIZE} height={ARENA_SIZE} style={styles.arena}>
          {/* Background */}
          <Rect x={0} y={0} width={ARENA_SIZE} height={ARENA_SIZE} fill="#4A5568" />
          
          {/* Grass pattern */}
          <Rect x={10} y={10} width={ARENA_SIZE - 20} height={ARENA_SIZE - 20} fill="#48BB78" rx={10} />
          
          {/* Safe zone indicator */}
          <Circle 
            cx={ARENA_SIZE / 2} 
            cy={ARENA_SIZE / 2} 
            r={gameState.poisonRadius} 
            fill="none" 
            stroke="#2ECC71" 
            strokeWidth={3}
            strokeDasharray="10,5"
          />

          {/* Poison zone overlay */}
          <Defs>
            <RadialGradient id="poison" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="transparent" />
              <Stop offset={`${(gameState.poisonRadius / (ARENA_SIZE / 2)) * 100}%`} stopColor="transparent" />
              <Stop offset={`${(gameState.poisonRadius / (ARENA_SIZE / 2)) * 100 + 5}%`} stopColor="rgba(128, 0, 128, 0.4)" />
              <Stop offset="100%" stopColor="rgba(128, 0, 128, 0.6)" />
            </RadialGradient>
          </Defs>
          <Circle cx={ARENA_SIZE / 2} cy={ARENA_SIZE / 2} r={ARENA_SIZE / 2} fill="url(#poison)" />

          {/* Some obstacles */}
          <Rect x={ARENA_SIZE * 0.2} y={ARENA_SIZE * 0.3} width={40} height={40} fill="#8B7355" rx={5} />
          <Rect x={ARENA_SIZE * 0.7} y={ARENA_SIZE * 0.2} width={35} height={35} fill="#8B7355" rx={5} />
          <Rect x={ARENA_SIZE * 0.6} y={ARENA_SIZE * 0.7} width={45} height={30} fill="#8B7355" rx={5} />
          <Rect x={ARENA_SIZE * 0.15} y={ARENA_SIZE * 0.65} width={30} height={40} fill="#8B7355" rx={5} />

          {/* Bullets */}
          {gameState.bullets.map(bullet => (
            <Circle
              key={bullet.id}
              cx={bullet.x}
              cy={bullet.y}
              r={BULLET_SIZE}
              fill={bullet.ownerId === 'player' ? '#F1C40F' : '#E74C3C'}
            />
          ))}

          {/* Bots */}
          {gameState.bots.map(bot => (
            <React.Fragment key={bot.id}>
              <Circle cx={bot.x} cy={bot.y} r={PLAYER_SIZE / 2} fill={bot.color} />
              <Circle cx={bot.x - 5} cy={bot.y - 3} r={4} fill="white" />
              <Circle cx={bot.x + 5} cy={bot.y - 3} r={4} fill="white" />
              <Circle cx={bot.x - 5} cy={bot.y - 3} r={2} fill="#333" />
              <Circle cx={bot.x + 5} cy={bot.y - 3} r={2} fill="#333" />
              <HealthBar health={bot.health} maxHealth={bot.maxHealth} x={bot.x} y={bot.y} />
            </React.Fragment>
          ))}

          {/* Player (Colt) */}
          <Circle cx={gameState.player.x} cy={gameState.player.y} r={PLAYER_SIZE / 2} fill={gameState.player.color} />
          {/* Eyes */}
          <Circle cx={gameState.player.x - 6} cy={gameState.player.y - 4} r={5} fill="white" />
          <Circle cx={gameState.player.x + 6} cy={gameState.player.y - 4} r={5} fill="white" />
          <Circle cx={gameState.player.x - 6} cy={gameState.player.y - 4} r={2.5} fill="#333" />
          <Circle cx={gameState.player.x + 6} cy={gameState.player.y - 4} r={2.5} fill="#333" />
          {/* Mouth */}
          <Rect x={gameState.player.x - 6} y={gameState.player.y + 5} width={12} height={3} rx={1} fill="#333" />
          {/* Player health bar */}
          <HealthBar health={gameState.player.health} maxHealth={gameState.player.maxHealth} x={gameState.player.x} y={gameState.player.y} />
        </Svg>
      </View>

      {/* Joysticks */}
      <View style={styles.controlsContainer}>
        <VirtualJoystick
          position="left"
          onMove={handleMove}
          onRelease={handleMoveRelease}
        />
        <VirtualJoystick
          position="right"
          onMove={handleAttack}
          onRelease={handleAttackRelease}
          isAttack
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#F1C40F',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#888',
    marginTop: 5,
  },
  characterPreview: {
    alignItems: 'center',
    marginVertical: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    borderRadius: 20,
  },
  characterName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498DB',
    marginTop: 10,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 30,
  },
  modeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginLeft: 10,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ECC71',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    marginTop: 10,
  },
  menuButton: {
    backgroundColor: '#3498DB',
  },
  playButtonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
  },
  instructions: {
    marginTop: 40,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: '#888',
    marginVertical: 5,
  },
  wonBg: {
    backgroundColor: '#1a2e1a',
  },
  lostBg: {
    backgroundColor: '#2e1a1a',
  },
  gameContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hudLeft: {
    flexDirection: 'column',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  healthBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  healthBarBg: {
    width: 100,
    height: 12,
    backgroundColor: '#333',
    borderRadius: 6,
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  healthText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  aliveText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 6,
  },
  arenaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arena: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    height: 180,
  },
  joystickContainer: {
    alignItems: 'center',
  },
  joystickLeft: {
    alignSelf: 'flex-start',
  },
  joystickRight: {
    alignSelf: 'flex-end',
  },
  joystickBase: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  joystickKnob: {
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  joystickLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
  },
});
