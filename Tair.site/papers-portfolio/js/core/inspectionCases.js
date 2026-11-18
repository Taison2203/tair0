/** Independent fictional cases. Data and verdict stay together to prevent contradictory papers. */
const templates=[
 {name:'Лидия Корина',birth:'14.05.1957',permitBirth:'14.05.1951',until:'30.11.1982',problem:'birth'},
 {name:'Марк Ветров',birth:'02.09.1954',until:'12.12.1982',problem:null},
 {name:'Егор Белов',birth:'19.02.1960',until:'21.11.1982',problem:'until'},
 {name:'Анна Мирова',permitName:'Анна Мирнова',birth:'12.03.1959',until:'30.11.1982',problem:'name'},
 {name:'Лев Орлов',birth:'08.08.1950',until:'23.11.1982',problem:null},
 {name:'Вера Зорина',birth:'03.01.1962',until:'18.12.1982',problem:'number'},
 {name:'Ян Северин',birth:'17.06.1956',until:'24.11.1982',problem:null},
 {name:'Мила Волкова',birth:'24.04.1961',permitBirth:'24.04.1960',until:'29.11.1982',problem:'birth'},
 {name:'Павел Тихов',birth:'09.12.1952',until:'19.11.1982',problem:'until'},
 {name:'Нина Белова',birth:'21.07.1958',until:'02.12.1982',problem:null},
];
export function createInspectionCases(count=5,random=Math.random){
 const pool=templates.map(t=>{const number='PV-'+String(Math.floor(random()*90000)+10000);return {...t,number,permitName:t.permitName||t.name,permitBirth:t.permitBirth||t.birth,permitNumber:t.problem==='number'?number.slice(0,-1)+(Number(number.at(-1))+1)%10:number};});
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,Math.min(count,pool.length));
}
