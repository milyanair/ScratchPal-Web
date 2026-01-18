export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
}

export interface Game {
  id: string;
  game_number: string;
  game_name: string;
  state: string;
  price: number;
  top_prize: number;
  top_prizes_remaining: number;
  total_top_prizes: number;
  overall_odds?: string;
  start_date?: string;
  end_date?: string;
  image_url?: string;
  image_converted?: boolean;
  original_image_url?: string;
  rank: number;
  upvotes: number;
  downvotes: number;
  slug?: string;
  source?: string;
  source_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPreference {
  id: string;
  user_id: string;
  selected_state: string;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  favorite_type: 'game' | 'store' | 'topic';
  reference_id: string;
  created_at: string;
}

export interface ForumTopic {
  id: string;
  user_id: string;
  game_id?: string;
  category: 'General' | 'Game Talk' | 'Tips & Tricks' | 'Q&A' | 'Ask Us' | 'Report a Problem';
  title: string;
  content: string;
  image_urls?: string[];
  upvotes: number;
  is_pinned: boolean;
  slug?: string;
  created_at: string;
  updated_at: string;
  game?: Game;
  post_count?: number;
}

export interface ForumPost {
  id: string;
  topic_id: string;
  user_id: string;
  content: string;
  image_urls?: string[];
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  store_type?: string;
  created_at: string;
}

export interface Win {
  id: string;
  user_id: string;
  game_id: string;
  store_id?: string;
  win_amount: number;
  image_url?: string;
  created_at: string;
  game?: Game;
  store?: Store;
}

export interface SliderMessage {
  id: string;
  message: string;
  transition_type: 'fade' | 'zoom' | 'flip' | 'slide';
  duration: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Gamification Types
export interface PointsConfig {
  activity_name: string;
  points_awarded: number;
  instant_fanfare: boolean;
  display_name: string;
  is_active: boolean;
  daily_limit?: number;
  weekly_limit?: number;
  created_at: string;
  updated_at: string;
}

export interface UserPoints {
  id: string;
  user_id: string;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export interface PointsHistory {
  id: string;
  user_id: string;
  activity_name: string;
  points_earned: number;
  description?: string;
  created_at: string;
}

export interface ReferralCode {
  id: string;
  user_id: string;
  referral_code: string;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  referral_code: string;
  is_signup: boolean;
  created_at: string;
}

export interface PendingFanfare {
  id: string;
  activity_name: string;
  points_earned: number;
  display_name: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  total_points: number;
}

export interface StateConfig {
  state_code: string;
  state_name: string;
  emoji: string;
  country: string;
  display_order: number;
  is_visible?: boolean;
  created_at: string;
  updated_at: string;
}

// DEPRECATED: Use dynamic state_config table instead
// This is kept for reference only
export const US_STATES = [
  { code: 'GA', name: 'Georgia', emoji: '🍑' },
  { code: 'AR', name: 'Arkansas', emoji: '⛈️' },
  { code: 'TX', name: 'Texas', emoji: '🤠' },
  { code: 'AZ', name: 'Arizona', emoji: '🌵' },
  { code: 'FL', name: 'Florida', emoji: '🌴' },
  { code: 'CA', name: 'California', emoji: '☀️' },
];
