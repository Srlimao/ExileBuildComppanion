import type { AscendancyOrderSource } from "@exile-hud/core";

export interface AscendancyOrderWidgetMessages {
  eyebrow: string;
  nodeOrderHeading: string;
  nextBadge: string;
  allocatedBadge: string;
  allAllocated: string;
  noAscendancySelected: string;
  noAscendancyNodesInPob: string;
  pointsShort: (allocated: number, planned: number) => string;
  nodesShort: (allocated: number, total: number) => string;
  sourceBadges: Record<AscendancyOrderSource, string>;
  labTiers: Record<1 | 2 | 3 | 4, string>;
  svgAriaLabel: (name: string) => string;
}

export const PT_BR_ASCENDANCY_ORDER_MESSAGES: AscendancyOrderWidgetMessages = {
  eyebrow: "Ascendência",
  nodeOrderHeading: "Ordem dos Nós",
  nextBadge: "PRÓXIMO",
  allocatedBadge: "Alocado",
  allAllocated: "Todos os nós da Ascendência alocados.",
  noAscendancySelected: "Nenhuma Ascendência definida no PoB carregado.",
  noAscendancyNodesInPob: "Nenhum nó de Ascendência encontrado nas árvores do PoB.",
  pointsShort: (allocated, planned) => `${allocated}/${planned} pts`,
  nodesShort: (allocated, total) => `${allocated}/${total}`,
  sourceBadges: {
    multi_spec: "Etapas PoB",
    pob_notes: "Notas PoB",
    tree_path: "Caminho",
    none: "",
  },
  labTiers: {
    1: "Lab Normal",
    2: "Lab Cruel",
    3: "Lab Merciless",
    4: "Lab Eternal",
  },
  svgAriaLabel: (name) => `Árvore da Ascendência ${name}`,
};

export const EN_ASCENDANCY_ORDER_MESSAGES: AscendancyOrderWidgetMessages = {
  eyebrow: "Ascendancy",
  nodeOrderHeading: "Node Order",
  nextBadge: "NEXT",
  allocatedBadge: "Allocated",
  allAllocated: "All planned Ascendancy nodes allocated.",
  noAscendancySelected: "No Ascendancy set in the loaded PoB.",
  noAscendancyNodesInPob: "No Ascendancy nodes found in the PoB tree specs.",
  pointsShort: (allocated, planned) => `${allocated}/${planned} pts`,
  nodesShort: (allocated, total) => `${allocated}/${total}`,
  sourceBadges: {
    multi_spec: "PoB Specs",
    pob_notes: "PoB Notes",
    tree_path: "Tree Path",
    none: "",
  },
  labTiers: {
    1: "Normal Lab",
    2: "Cruel Lab",
    3: "Merciless Lab",
    4: "Eternal Lab",
  },
  svgAriaLabel: (name) => `${name} Ascendancy tree`,
};
