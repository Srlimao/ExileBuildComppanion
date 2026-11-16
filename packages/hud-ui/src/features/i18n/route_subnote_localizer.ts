import type { HudLocale } from "./locale_storage_and_types.js";

const EXACT_SUBNOTE_PT_BR: Readonly<Record<string, string>> = {
  "Little streams connect the 3 Rhoa nests": "Pequenos riachos conectam os 3 ninhos de Rhoa",
  "Usually form a triangle, but will rarely form a line": "Geralmente formam um triângulo; raramente formam uma linha",
  "If you find a ledge, turn around and go 90°": "Se encontrar um penhasco (ledge), dê meia-volta e vá para 90°",
  "Go right of the bridge": "Vá pela direita da ponte",
  "Search opposite the entrance": "Procure no lado oposto à entrada",
  "Look for the large empty room": "Procure a sala grande vazia",
  "Look for map icon, access with nearby switch": "Procure o ícone no mapa; acesse pelo interruptor próximo",
  "High chance for Quicksilver Flask": "Alta chance de Quicksilver Flask",
  "Vendor Quicksilver Flask + Orb of Augmentation + Normal Boots": "Receita de Vendor: Quicksilver Flask + Orb of Augmentation + Normal Boots",
  "Vendor Quicksilver Flask + Orb of Augmentation + Movement Speed Boots": "Receita de Vendor: Quicksilver Flask + Orb of Augmentation + Movement Speed Boots",
  "Go down the ledge next to the road": "Desça a beirada ao lado da estrada",
  "Follow the water": "Siga a água",
  "Follow the road": "Siga a estrada",
  "Go in same direction as Waypoint": "Vá na mesma direção do Waypoint",
  "Look for the long hallway": "Procure o corredor longo",
  "Search the side of road opposite Waypoint": "Procure do lado da estrada oposto ao Waypoint",
  "Try go 270°, if it's blocked go 45°": "Tente ir para 270°; se estiver bloqueado, vá para 45°",
  "Look for 2 pillars near Waypoint, follow the trail": "Procure 2 pilares perto do Waypoint e siga a trilha",
  "Search opposite direction of the encampment entrance": "Procure na direção oposta à entrada do acampamento",
  "Go 180° look for the torch touching the road": "Vá para 180° e procure a tocha encostada na estrada",
  "Follow the trail in the direction of the torch": "Siga a trilha na direção da tocha",
  "Follow the road 225°": "Siga a estrada para 225°",
  "S shape or L shape leads to exit": "Formato em S ou L leva à saída",
  "First floor exit will be in one of the 3 corners": "A saída do primeiro andar fica em um dos 3 cantos",
  "Remaining floors will have the exit diagonally across from the entrance": "Os demais andares têm a saída na diagonal oposta à entrada",
  "Follow Stairs": "Siga as escadas",
  "Look around nearby": "Procure por perto",
  "Follow stairs that are going up": "Siga as escadas que sobem",
  "At the fork in the road with wagons, go the route with 1 wagon, not 2": "Na bifurcação com carroças, siga o caminho com 1 carroça (não o de 2)",
  "Look for a candle in a narrow corridor": "Procure uma vela em um corredor estreito",
  "Put currency needed to buy skill gems in inventory": "Coloque no inventário a currency necessária para comprar skill gems",
  "Stairs spawn in one of the corners": "As escadas aparecem em um dos cantos",
  "Look for barricades": "Procure as barricadas",
  "Follow Bridges": "Siga as pontes",
  "Go 225° follow the exits keeping 270°": "Vá para 225° e siga as saídas mantendo 270°",
  "Go 180° until you find the hanged Karui": "Vá para 180° até encontrar o Karui enforcado",
  "Loop around clockwise to go 270°": "Contorne no sentido horário para seguir para 270°",
  "Go 270° as much as possible": "Vá para 270° o máximo possível",
  "Go 45° from Miasmeter": "Vá para 45° a partir de Miasmeter",
  "Loop around clockwise": "Contorne no sentido horário",
  "Go 315° counter-clockwise spiral": "Siga em espiral anti-horária para 315°",
  "Loop around counter-clockwise": "Contorne no sentido anti-horário",
  "Go 225° find the plaza": "Vá para 225° e encontre a praça",
  "45° corner of area, normally by a house": "Canto 45° da área, geralmente perto de uma casa",
  "Find and kill the pack of monster on the island 225° for a Tattoo": "Encontre e mate o grupo de monstros na ilha a 225° para ganhar uma Tattoo",
  "Look for the torch touching the road": "Procure a tocha encostada na estrada",
  "Follow the road until it ends": "Siga a estrada até o fim",
  "Follow the shore": "Siga a margem",
  "Follow the road, look for the broken Waypoint": "Siga a estrada e procure o Waypoint quebrado",
  "Follow edges of the zone and cross bridges in the corners": "Siga as bordas da zona e atravesse as pontes nos cantos",
  "Typically bridges spawn in the opposite diagonal corners": "Normalmente as pontes ficam nos cantos diagonais opostos",
  "Find the switch hidden behind Trial of Ascendancy Plaque to access Hidden Gem: Quality":
    "Encontre o interruptor escondido atrás de Trial of Ascendancy Plaque para acessar Hidden Gem: Quality",
  "In the room with a central pit, look 225° or 45° for a side area containing a Corrupted Unique":
    "Na sala com o fosso central, olhe para 225° ou 45° para uma sala lateral com um Corrupted Unique",
  "Black splashes of paint on ground points to the right direction to go":
    "Manchas pretas de tinta no chão apontam a direção certa",
  "Follow 270° wall": "Siga a parede a 270°",
  "Follow the dead guards by doorways": "Siga os guardas mortos perto das passagens",
  "Look for a book icon": "Procure o ícone de livro",
  "Follow the road until Waypoint": "Siga a estrada até o Waypoint",
  "Search 270° side": "Procure no lado 270°",
  "Go 45° until you find the cliff": "Vá para 45° até encontrar o penhasco",
  "Go 45° look for petrified soldiers": "Vá para 45° e procure soldados petrificados",
  "Look for the hidden switch halfway to Trial of Ascendancy Plaque in the corner opposite the entrance to access Hidden Gem: Transfigured":
    "Procure o interruptor escondido no meio do caminho até Trial of Ascendancy Plaque, no canto oposto à entrada, para acessar Hidden Gem: Transfigured",
  "Look for a sewer grate leading to Refinery Tunnels, it is attached to the cart tracks":
    "Procure uma grade de esgoto levando para Refinery Tunnels, ligada aos trilhos dos carrinhos",
  "Go 45° follow cart tracks": "Vá para 45° seguindo os trilhos dos carrinhos",
  "Interact with the switch just before the zig-zagging walls, go to the opposite side to access Hidden Gem: Facetor's Lens":
    "Interaja com o interruptor logo antes das paredes em zigue-zague e vá para o lado oposto para acessar Hidden Gem: Facetor's Lens",
  "Type /passives in chat to confirm that you have all 24 passives from quests":
    "Digite /passives no chat para confirmar se você tem todas as 24 passivas de quests",
  "Type /passives in chat to confirm that you have all 23 passives from quests":
    "Digite /passives no chat para confirmar se você tem todas as 23 passivas de quests",
};

/** Localizes a `#sub` zone navigation hint to PT-BR while keeping PoE items, objects, and commands in English. */
export function localizeRouteSubNote(note: string, locale: HudLocale): string {
  if (locale === "en" || !note) return note;

  const trimmed = note.trim();
  const exact = EXACT_SUBNOTE_PT_BR[trimmed];
  if (exact) return exact;

  let m: RegExpExecArray | null;
  if ((m = /^Go\s+(\d+°)$/i.exec(trimmed))) return `Vá para ${m[1]}`;
  if ((m = /^Usually\s+(\d+°)$/i.exec(trimmed))) return `Geralmente ${m[1]}`;
  if ((m = /^Search\s+(\d+°)$/i.exec(trimmed))) return `Procure em ${m[1]}`;
  if ((m = /^(\d+°)\s+or\s+(\d+°)$/i.exec(trimmed))) return `${m[1]} ou ${m[2]}`;
  if ((m = /^Recommended Level:\s*(.+)$/i.exec(trimmed))) return `Nível recomendado: ${m[1]}`;
  if ((m = /^Farm Level:\s*(.+)$/i.exec(trimmed))) return `Nível de farm: ${m[1]}`;

  return trimmed;
}
