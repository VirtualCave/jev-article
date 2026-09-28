export type ChatBadge = "mod" | "vip" | "sub" | "prime";
export type ChatUser = { name: string; color: string; badges: ChatBadge[] };
export type ChatMessage = { id: string; text: string; toxic: boolean; spam: boolean; user: ChatUser };

const names = [
  "mikaTV", "nico_plays", "auroraGG", "paloma", "kenji_", "luna_clip", "pablo8", "sofia_live",
  "hugoFast", "valen", "irina", "marcoR", "nerea", "otto", "yasmin", "dario",
  "kira_fn", "belen", "tomas", "noa", "alexis", "rumi", "ferchu", "ina",
  "gabo", "lila", "santi", "ome", "vera", "jona", "milo", "cami",
  "rafa", "nuri", "leo_ttv", "iris", "pau", "dante", "sol", "nando",
];
const colors = [
  "#FF7F50", "#1E90FF", "#00FF7F", "#FF69B4", "#9ACD32", "#FF4500", "#2E8B57", "#DAA520",
  "#D2691E", "#5F9EA0", "#8A2BE2", "#B22222", "#00BFFF", "#FF1493", "#7CFC00", "#FFD700",
];

function userFor(index: number): ChatUser {
  const badges: ChatBadge[] = [];
  if (index % 23 === 0) badges.push("mod");
  if (index % 11 === 2) badges.push("vip");
  if (index % 5 === 1) badges.push("sub");
  if (index % 13 === 4) badges.push("prime");
  return { name: names[index % names.length], color: colors[index % colors.length], badges };
}

const safe = `Good morning everyone!|Who watched the match last night?|Thanks for the explanation.|Can someone share the schedule?|I like the new update.|Welcome to the stream!|That was a close round.|Nice work by the team.|The audio is much clearer now.|I learned something new today.|What time does the event begin?|Hello from Barcelona!|Great question in the chat.|The next game should be fun.|I appreciate the quick response.|Let's keep the discussion friendly.|That strategy worked well.|Could you repeat the last point?|The camera angle looks good.|This is my first time here.|Have a good weekend, everyone.|The scoreboard updated late.|Does anyone know the rules?|I enjoyed the previous episode.|The host explained it clearly.|Which map comes next?|The music is a bit loud.|I agree with your analysis.|That was an interesting play.|Please share the link to the official rules.|The replay starts in five minutes.|I am cheering for the blue team.|What a surprising result!|The captions are working now.|I missed the first round.|The moderator answered my question.|This community is helpful.|Can we get a slower replay?|The tutorial helped me a lot.|I like this format.|That was a fair decision.|The players look focused.|Where can I see the standings?|Thanks for keeping us updated.|The stream is smooth today.|I will be back tomorrow.|Good luck in the final.|I appreciate the civil debate.|What a comeback!|See you all next week.`;
const toxic = `You are an idiot and should leave.|Shut up, nobody wants your opinion.|That player is completely worthless.|Only a fool would believe that.|I hate everyone on this team.|You are too stupid to understand.|Get lost, you moron.|The host is a pathetic liar.|Your comment is garbage.|Everyone here is an idiot.|Stop talking, loser.|That was a brain-dead decision.|I hope your team gets humiliated.|Nobody likes you in this chat.|You are an absolute clown.|This community is full of fools.|Your analysis is embarrassingly dumb.|What a pathetic performance.|The moderator is a useless idiot.|Quit the game, you loser.|I cannot stand your stupid comments.|That team is trash.|You have no idea what you are saying, fool.|Go away and stop wasting our time.|Your opinion is worthless.|Only an idiot would play like that.|You are a complete fraud.|I hate your voice.|This chat is full of morons.|Stop being such a clown.|The host is hopelessly incompetent.|What a stupid thing to say.|You are ruining this stream, loser.|Nobody asked for your dumb take.|That was a worthless effort.|I hope you fail badly.|Your strategy is total garbage.|You cannot even read the rules, idiot.|The whole team is pathetic.|Shut your mouth and leave.|I am sick of your nonsense.|That was an idiotic move.|You are an embarrassment here.|Nobody should listen to you.|This match is full of losers.|Stop making stupid excuses.|I despise this player.|What a clueless comment.|You are a terrible person.|Get out of this chat, fool.`;
const spam = `Win free coins at bonus-example.net!|Claim your prize by clicking this link.|Buy followers fast at social-boost.example.|Visit my channel for guaranteed giveaways.|Free gift cards for the first ten clicks!|Earn money quickly from home, sign up now.|Limited sale on game credits at this link.|Click here for a secret discount code.|Subscribe to my channel for a free prize.|Instant rewards available at prize-example.net.|Get cheap accounts today, message me.|Our exclusive offer expires in one minute.|Unlock premium access for only one dollar.|Free skins for everyone who registers now.|Visit cash-example.net to earn daily rewards.|Click this link and claim a new phone.|Guaranteed jackpot, enter your details.|Buy our miracle gaming booster now.|A special voucher is waiting for you.|Register here to double your points.|Win a console by forwarding this message.|Free subscriptions at promo-example.net.|Act now and receive a cash bonus.|Exclusive deal: pay less for every game.|Click to collect your VIP reward.|Make fast money with our secret system.|Your reward is ready at claim-example.net.|Buy game currency for half price here.|Giveaway ends soon; follow my profile.|Free premium badges if you sign up today.|Special discount for the first 100 users.|I can sell you cheap followers, DM me.|Instant access to paid streams for free.|Get a $500 voucher from our new site.|Try this promotion and win every round.|Cheap gaming gear at deals-example.net.|Sign up now for unlimited free coins.|Do not miss this one-time cash offer.|Click our link for a surprise reward.|Subscribe and get a secret promo code.|My referral gives you a free upgrade.|Claim exclusive merch at this URL.|Earn rewards by inviting five friends.|We sell verified accounts, contact us.|Your lucky number won a free trip!|Pay a tiny fee to unlock your prize.|Visit my store for unbeatable discounts.|Win a gift card by filling this form.|Free VIP access at vip-example.net.|Click here now for unlimited rewards.`;
const safeRows = safe.split("|"), toxicRows = toxic.split("|"), spamRows = spam.split("|");
export const chatMessages: ChatMessage[] = Array.from({ length: 50 }, (_, index) => [
  { text: safeRows[index], toxic: false, spam: false },
  { text: toxicRows[index], toxic: true, spam: false },
  { text: spamRows[index], toxic: false, spam: true },
]).flat().map((item, index) => ({ id: `chat-${index + 1}`, user: userFor(index), ...item }));

const garnishPool = ["<3", "Pog", "GG", "LUL", "Kappa", "KEKW", ":)", "EZ"] as const;
export function chatGarnish(id: string, toxic: boolean, spam: boolean): string[] {
  if (toxic || spam) return [];
  const n = Number.parseInt(id.replace(/\D/g, ""), 10) || 0;
  if (n % 3 !== 0) return [];
  return [garnishPool[n % garnishPool.length]];
}
