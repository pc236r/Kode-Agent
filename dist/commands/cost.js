import { formatTotalCost } from '@costTracker';
const cost = {
    type: 'local',
    name: 'cost',
    description: 'Show the total cost and duration of the current session',
    isEnabled: true,
    isHidden: false,
    async call() {
        return formatTotalCost();
    },
    userFacingName() {
        return 'cost';
    },
};
export default cost;
//# sourceMappingURL=cost.js.map