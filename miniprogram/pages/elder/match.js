const { getPersonListAPI, getMemoryPairsAPI } = require("../../api/user");
const {
  isPreviewMode,
  previewMatchCards
} = require("../../utils/elder-preview");

function resolveTempFileURLs(fileIDs = []) {
  const validFileIDs = Array.from(
    new Set((Array.isArray(fileIDs) ? fileIDs : []).filter((item) => typeof item === "string" && item.startsWith("cloud://")))
  );
  if (!validFileIDs.length) {
    return Promise.resolve({});
  }

  return wx.cloud.getTempFileURL({ fileList: validFileIDs }).then((res) => {
    const urlMap = {};
    (res.fileList || []).forEach((item) => {
      if (item.fileID && (item.tempFileURL || item.tempFileUrl)) {
        urlMap[item.fileID] = item.tempFileURL || item.tempFileUrl;
      }
    });
    return urlMap;
  }).catch(() => ({}));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

Page({
  data: {
    previewMode: false,
    cards: [],
    firstIndex: -1,
    secondIndex: -1,
    lock: false,
    win: false
  },

  onLoad(options = {}) {
    this.setData({ previewMode: isPreviewMode(options) });
  },

  onShow() {
    this.resetGame();
  },

  async resetGame() {
    this.setData({ cards: [], firstIndex: -1, secondIndex: -1, lock: false, win: false });
    try {
      if (this.data.previewMode) {
        this.setData({ cards: shuffle(previewMatchCards.map((item) => ({ ...item }))) });
        return;
      }

      const pairs = await getMemoryPairsAPI();
      let cards = [];
      const usablePairs = Array.isArray(pairs) ? pairs.filter(p => p && p.leftImg && p.rightImg) : [];
      if (usablePairs.length) {
        const pickPairs = usablePairs.slice(0, 4); // 最多 4 组（8 张牌）
        pickPairs.forEach((p, idx) => {
          const pairId = `MP${idx}`;
          cards.push({
            id: `${pairId}-l`,
            pairId,
            type: "img",
            img: p.leftImg,
            text: "",
            flipped: false,
            matched: false
          });
          cards.push({
            id: `${pairId}-r`,
            pairId,
            type: "img",
            img: p.rightImg,
            text: "",
            flipped: false,
            matched: false
          });
        });
      } else {
        const persons = await getPersonListAPI();
        const usable = (persons || []).filter(p => p && (p.avatar || p.name));
        const pick = usable.slice(0, 4); // 最多 4 组（8 张牌）
        pick.forEach((p, idx) => {
          const pairId = `P${idx}`;
          if (p.avatar) {
            cards.push({
              id: `${pairId}-img`,
              pairId,
              type: "img",
              img: p.avatar,
              text: "",
              flipped: false,
              matched: false
            });
            cards.push({
              id: `${pairId}-name`,
              pairId,
              type: "name",
              img: "",
              text: p.name || "未命名",
              flipped: false,
              matched: false
            });
          } else {
            // 如果没有头像，退化为两张同名牌
            cards.push({
              id: `${pairId}-n1`,
              pairId,
              type: "name",
              img: "",
              text: p.name || "未命名",
              flipped: false,
              matched: false
            });
            cards.push({
              id: `${pairId}-n2`,
              pairId,
              type: "name",
              img: "",
              text: p.name || "未命名",
              flipped: false,
              matched: false
            });
          }
        });
      }
      if (!cards.length) {
        this.setData({ cards: [] });
        return;
      }
      const urlMap = await resolveTempFileURLs(cards.map((item) => item && item.img));
      this.setData({
        cards: shuffle(cards.map((item) => ({
          ...item,
          img: urlMap[item.img] || item.img || ""
        })))
      });
    } catch (e) {
      this.setData({ cards: [] });
    }
  },

  tapCard(e) {
    const idx = Number(e.currentTarget.dataset.index);
    if (this.data.lock || this.data.win) return;
    const cards = this.data.cards.slice();
    const card = cards[idx];
    if (!card || card.matched || card.flipped) return;

    card.flipped = true;
    this.setData({ cards });

    if (this.data.firstIndex === -1) {
      this.setData({ firstIndex: idx });
      return;
    }
    if (this.data.secondIndex === -1) {
      this.setData({ secondIndex: idx, lock: true });
      setTimeout(() => this.checkMatch(), 500);
      return;
    }
  },

  checkMatch() {
    const { firstIndex, secondIndex } = this.data;
    if (firstIndex < 0 || secondIndex < 0) {
      this.setData({ lock: false });
      return;
    }
    const cards = this.data.cards.slice();
    const a = cards[firstIndex];
    const b = cards[secondIndex];
    if (a && b && a.pairId === b.pairId && firstIndex !== secondIndex) {
      a.matched = true;
      b.matched = true;
      this.setData({ cards });
      const left = cards.some(c => !c.matched);
      this.setData({ firstIndex: -1, secondIndex: -1, lock: false, win: !left });
    } else {
      a.flipped = false;
      b.flipped = false;
      this.setData({ cards, firstIndex: -1, secondIndex: -1, lock: false });
    }
  }
});
