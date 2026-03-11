// components/tree-node/tree-node.js
Component({
  properties: {
    node: Object
  },

  data: {

  },

  methods: {
    handleClick() {
      this.triggerEvent("click", { id: this.data.node.id });
    },

    propagateClick(e) {
      this.triggerEvent("click", e.detail);
    }
  }
})