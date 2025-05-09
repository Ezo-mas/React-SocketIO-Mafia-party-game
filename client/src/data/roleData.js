const roleData = [
  {
    name: 'Civilian',
    description: 'A regular town member. Your goal is to find and eliminate the Mafia.',
    alignment: 'town'
  },
  {
    name: 'Doctor',
    description: 'Each night, as a dcotor you can choose one player to protect. That player will be immune to death that night.',
    alignment: 'doctor'
  },
  {
    name: 'Detective',
    description: 'Each night, you can investigate one player to find out if they are mafia or not.',
    alignment: 'detective'
  },
  {
    name: 'Mafia',
    description: 'As a mafia member each night you work with your mafia team to eliminate the town members.',
    alignment: 'mafia'
   },
  {
    name: 'Jester',
    description: 'Your goal is to act suspicious and make the town members vote you out. If you succeed, you win the game.',
    alignment: 'neutral'
  },
  
  // Add more roles as needed
  // {
  //   name: 'Vigilante',
  //   description: 'You are a town-aligned player who can eliminate one player during the night phase.',
  //   alignment: 'town'
  // },
];

export default roleData;