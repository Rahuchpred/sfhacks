// Seeds SFSU buildings and sample events. Run with: npm run seed
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Coordinates are approximate and should be checked against the campus map.
const buildings = [
  { id: "cesar-chavez", name: "Cesar Chavez Student Center", aliases: ["CCSC", "Student Center", "Caesar Chavez", "Rosa Parks", "Jack Adams Hall"], lat: 37.7224, lng: -122.4787 },
  { id: "malcolm-x-plaza", name: "Malcolm X Plaza", aliases: ["the Plaza", "outside the Student Center"], lat: 37.7221, lng: -122.4792 },
  { id: "library", name: "J. Paul Leonard Library", aliases: ["LIB", "the library", "outside the library"], lat: 37.7214, lng: -122.4780 },
  { id: "quad", name: "The Quad", aliases: ["Quad", "campus quad", "the lawn"], lat: 37.7231, lng: -122.4794 },
  { id: "hss", name: "Health and Social Sciences", aliases: ["HSS"], lat: 37.7218, lng: -122.4761 },
  { id: "business", name: "Business Building", aliases: ["BUS", "Lam Family College of Business"], lat: 37.7220, lng: -122.4769 },
  { id: "science", name: "Science Building", aliases: ["SCI", "Science and Engineering Innovation Center", "SEIC"], lat: 37.7230, lng: -122.4763 },
  { id: "hensill", name: "Hensill Hall", aliases: ["HH"], lat: 37.7235, lng: -122.4759 },
  { id: "thornton", name: "Thornton Hall", aliases: ["TH"], lat: 37.7238, lng: -122.4769 },
  { id: "burk", name: "Burk Hall", aliases: ["BH"], lat: 37.7230, lng: -122.4801 },
  { id: "humanities", name: "Humanities Building", aliases: ["HUM"], lat: 37.7224, lng: -122.4810 },
  { id: "creative-arts", name: "Creative Arts Building", aliases: ["CA", "McKenna Theatre"], lat: 37.7216, lng: -122.4797 },
  { id: "fine-arts", name: "Fine Arts Building", aliases: ["FA"], lat: 37.7223, lng: -122.4801 },
  { id: "ethnic-studies", name: "Ethnic Studies and Psychology", aliases: ["EP"], lat: 37.7236, lng: -122.4790 },
  { id: "student-services", name: "Student Services Building", aliases: ["SSB"], lat: 37.7234, lng: -122.4808 },
  { id: "admin", name: "Administration Building", aliases: ["ADM"], lat: 37.7212, lng: -122.4767 },
  { id: "gym", name: "Gymnasium", aliases: ["GYM", "Don Nasser Family Plaza"], lat: 37.7239, lng: -122.4782 },
  { id: "mashouf", name: "Mashouf Wellness Center", aliases: ["MWC", "the Mashouf"], lat: 37.7230, lng: -122.4838 },
  { id: "annex", name: "Annex I", aliases: ["the Annex", "Student Life Events Center"], lat: 37.7262, lng: -122.4826 },
];

// Times are relative to now, so the map always has upcoming events.
const hours = (n) => new Date(Date.now() + n * 3600_000).toISOString();

const events = [
  { title: "SF Hacks x GDG AI Hackathon", description: "Build an AI project for SF State in one day. Free lunch and snacks.", club_name: "SF Hacks", building_id: "annex", room: null, starts_at: hours(-1), ends_at: hours(8), tags: ["academic", "career", "free food"], has_food: true },
  { title: "Boba and Board Games Night", description: "Free boba, board games and a chance to meet the club.", club_name: "Asian Student Union", building_id: "cesar-chavez", room: "Rosa Parks A-C", starts_at: hours(3), ends_at: hours(5), tags: ["social", "cultural", "free food"], has_food: true },
  { title: "Resume Drop-In", description: "Bring a printed resume for a 10-minute review with a career counselor.", club_name: "Career and Leadership Development", building_id: "student-services", room: "301", starts_at: hours(1), ends_at: hours(3), tags: ["career"], has_food: false },
  { title: "Farmers Market", description: "Local produce and food stands. CalFresh accepted.", club_name: "Associated Students", building_id: "malcolm-x-plaza", room: null, starts_at: hours(0.5), ends_at: hours(4), tags: ["wellness", "social"], has_food: true },
  { title: "Intro to Machine Learning Workshop", description: "Hands-on notebook session, no experience needed. Bring a laptop.", club_name: "Google Developer Group SFSU", building_id: "thornton", room: "429", starts_at: hours(26), ends_at: hours(28), tags: ["academic", "career"], has_food: false },
  { title: "Open Mic on the Quad", description: "Music, poetry and comedy. Sign up at the table to perform.", club_name: "Associated Students Productions", building_id: "quad", room: null, starts_at: hours(27), ends_at: hours(29), tags: ["arts", "social"], has_food: false },
  { title: "Study Night with Free Pizza", description: "Quiet group study before midterms. Pizza while it lasts.", club_name: "Computer Science Club", building_id: "library", room: "121", starts_at: hours(50), ends_at: hours(53), tags: ["academic", "free food"], has_food: true },
  { title: "Yoga for Beginners", description: "A calm 45-minute class. Mats provided.", club_name: "Campus Recreation", building_id: "mashouf", room: "Studio 2", starts_at: hours(49), ends_at: hours(50), tags: ["wellness", "sports"], has_food: false },
];

const { error: buildingError } = await supabase.from("buildings").upsert(buildings);
if (buildingError) throw buildingError;

const { error: clearError } = await supabase.from("events").delete().eq("source", "seed");
if (clearError) throw clearError;

const { error: eventError } = await supabase
  .from("events")
  .insert(events.map((event) => ({ ...event, source: "seed" })));
if (eventError) throw eventError;

console.log(`Seeded ${buildings.length} buildings and ${events.length} events.`);
