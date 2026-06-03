export type GroupType = 'hangout' | 'trip';

export type ExpenseCategory =
  | 'general'
  | 'uber'
  | 'meal'
  | 'activity'
  | 'car_rental'
  | 'hotel'
  | 'flight';

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  created_by: string;
  created_at: string;
  updated_at: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id?: string | null;
  display_name: string;
  joined_at: string;
}

export interface Expense {
  id: string;
  group_id: string;
  day_id?: string | null;
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency: string;
  paid_by: string;
  date: string;
  receipt_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
  is_paid: boolean;
}

export interface TripDay {
  id: string;
  group_id: string;
  date: string;
  label?: string | null;
  order: number;
}

export interface Flight {
  id: string;
  group_id: string;
  member_id: string;
  airline?: string | null;
  flight_number?: string | null;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  cost?: number | null;
}

export interface FlightSplit {
  id: string;
  flight_id: string;
  member_id: string;
  amount: number;
}

export interface Hotel {
  id: string;
  group_id: string;
  name: string;
  check_in: string;
  check_out: string;
  notes?: string | null;
  created_at: string;
}

export interface HotelRoom {
  id: string;
  hotel_id: string;
  room_label: string;
  cost: number;
  member_ids: string[];
}

export interface WishListItem {
  id: string;
  group_id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  added_by: string;
  votes: string[];
  is_completed: boolean;
  created_at: string;
}
