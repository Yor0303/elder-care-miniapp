Page({
  data: {
    showCard: false,
    currentPerson: {},
    treeData: [
      {
        id: 1,
        name: "爷爷",
        avatar: "/assets/images/avatar1.png",
        relation: "祖父",
        age: 78,
        health: "良好",
        description: "家里的长辈",
        children: [
          {
            id: 2,
            name: "爸爸",
            avatar: "/assets/images/avatar2.png",
            relation: "父亲",
            age: 50,
            health: "一般",
            description: "非常关心家人",
            children: [
              {
                id: 4,
                name: "我",
                avatar: "/assets/images/avatar4.png",
                relation: "本人",
                age: 25,
                health: "健康",
                description: "家庭成员",
                children: [
                  {
                    id: 5,
                    name: "孩子",
                    avatar: "/assets/images/avatar5.png",
                    relation: "孙子",
                    age: 3,
                    health: "健康",
                    description: "家里的小宝贝"
                  }
                ]
              }
            ]
          },
          {
            id: 3,
            name: "叔叔",
            avatar: "/assets/images/avatar3.png",
            relation: "叔叔",
            age: 48,
            health: "良好",
            description: "爸爸的弟弟"
          }
        ]
      }
    ]
  },

  showCard(e) {
    const id = e.detail.id;

    const findPerson = (list) => {
      for (const p of list) {
        if (p.id === id) return p;

        if (p.children) {
          const r = findPerson(p.children);
          if (r) return r;
        }
      }
      return null;
    };

    const person = findPerson(this.data.treeData);

    if (person) {
      this.setData({
        currentPerson: person,
        showCard: true
      });
    }
  },

  closeCard() {
    this.setData({
      showCard: false
    });
  }
});