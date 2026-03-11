// components/family-avatar/family-avatar.ts
Component({
  properties: { node: Object },
  methods: {
    clickNode(e:any) {
      // 必须传出当前节点 id
      this.triggerEvent("click", { id: this.data.node.id })
    }
  }
})