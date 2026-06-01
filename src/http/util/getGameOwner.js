const fetch = require("node-fetch");
const wait = require('node:timers/promises').setTimeout;

/**
 * Get game owner
 * @param {Number|String} placeId 
 * @returns {Promise<Number>}
 */
module.exports = async (placeId) => new Promise(async (resolve, reject) => {
    await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
        if (Object.hasOwnProperty.bind(res)("Creator")) {
            if (res["Creator"]["CreatorType"] == "User") {
                resolve(res["Creator"]["CreatorTargetId"]);
            } else if (res["Creator"]["CreatorType"] == "Group") {
                await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                    if (Object.hasOwnProperty.bind(res)("owner")) {
                        resolve(res["owner"]["userId"]);
                    } else {
                        reject("Invalid Group");
                    }
                }).catch(reject);
            } else {
                reject("Unknown CreatorType");
            }
        } else {
            reject("Invalid Place");
        }
    }).catch(async () => {
        await wait(Math.floor((Math.random() * 2000) + 1000));
        await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
            if (Object.hasOwnProperty.bind(res)("Creator")) {
                if (res["Creator"]["CreatorType"] == "User") {
                    resolve(res["Creator"]["CreatorTargetId"]);
                } else if (res["Creator"]["CreatorType"] == "Group") {
                    await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                        if (Object.hasOwnProperty.bind(res)("owner")) {
                            resolve(res["owner"]["userId"]);
                        } else {
                            reject("Invalid Group");
                        }
                    }).catch(reject);
                } else {
                    reject("Unknown CreatorType");
                }
            } else {
                reject("Invalid Place");
            }
        }).catch(async () => {
            await wait(Math.floor((Math.random() * 2000) + 1000));
            await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
                if (Object.hasOwnProperty.bind(res)("Creator")) {
                    if (res["Creator"]["CreatorType"] == "User") {
                        resolve(res["Creator"]["CreatorTargetId"]);
                    } else if (res["Creator"]["CreatorType"] == "Group") {
                        await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                            if (Object.hasOwnProperty.bind(res)("owner")) {
                                resolve(res["owner"]["userId"]);
                            } else {
                                reject("Invalid Group");
                            }
                        }).catch(reject);
                    } else {
                        reject("Unknown CreatorType");
                    }
                } else {
                    reject("Invalid Place");
                }
            }).catch(async () => {
                await wait(Math.floor((Math.random() * 2000) + 1000));
                await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
                    if (Object.hasOwnProperty.bind(res)("Creator")) {
                        if (res["Creator"]["CreatorType"] == "User") {
                            resolve(res["Creator"]["CreatorTargetId"]);
                        } else if (res["Creator"]["CreatorType"] == "Group") {
                            await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                                if (Object.hasOwnProperty.bind(res)("owner")) {
                                    resolve(res["owner"]["userId"]);
                                } else {
                                    reject("Invalid Group");
                                }
                            }).catch(reject);
                        } else {
                            reject("Unknown CreatorType");
                        }
                    } else {
                        reject("Invalid Place");
                    }
                }).catch(async () => {
                    await wait(Math.floor((Math.random() * 2000) + 1000));
                    await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
                        if (Object.hasOwnProperty.bind(res)("Creator")) {
                            if (res["Creator"]["CreatorType"] == "User") {
                                resolve(res["Creator"]["CreatorTargetId"]);
                            } else if (res["Creator"]["CreatorType"] == "Group") {
                                await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                                    if (Object.hasOwnProperty.bind(res)("owner")) {
                                        resolve(res["owner"]["userId"]);
                                    } else {
                                        reject("Invalid Group");
                                    }
                                }).catch(reject);
                            } else {
                                reject("Unknown CreatorType");
                            }
                        } else {
                            reject("Invalid Place");
                        }
                    }).catch(async () => {
                        await wait(Math.floor((Math.random() * 2000) + 1000));
                        await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
                            if (Object.hasOwnProperty.bind(res)("Creator")) {
                                if (res["Creator"]["CreatorType"] == "User") {
                                    resolve(res["Creator"]["CreatorTargetId"]);
                                } else if (res["Creator"]["CreatorType"] == "Group") {
                                    await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                                        if (Object.hasOwnProperty.bind(res)("owner")) {
                                            resolve(res["owner"]["userId"]);
                                        } else {
                                            reject("Invalid Group");
                                        }
                                    }).catch(reject);
                                } else {
                                    reject("Unknown CreatorType");
                                }
                            } else {
                                reject("Invalid Place");
                            }
                        }).catch(async () => {
                            await wait(Math.floor((Math.random() * 2000) + 1000));
                            await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
                                if (Object.hasOwnProperty.bind(res)("Creator")) {
                                    if (res["Creator"]["CreatorType"] == "User") {
                                        resolve(res["Creator"]["CreatorTargetId"]);
                                    } else if (res["Creator"]["CreatorType"] == "Group") {
                                        await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                                            if (Object.hasOwnProperty.bind(res)("owner")) {
                                                resolve(res["owner"]["userId"]);
                                            } else {
                                                reject("Invalid Group");
                                            }
                                        }).catch(reject);
                                    } else {
                                        reject("Unknown CreatorType");
                                    }
                                } else {
                                    reject("Invalid Place");
                                }
                            }).catch(async () => {
                                await wait(Math.floor((Math.random() * 2000) + 1000));
                                await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
                                    if (Object.hasOwnProperty.bind(res)("Creator")) {
                                        if (res["Creator"]["CreatorType"] == "User") {
                                            resolve(res["Creator"]["CreatorTargetId"]);
                                        } else if (res["Creator"]["CreatorType"] == "Group") {
                                            await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                                                if (Object.hasOwnProperty.bind(res)("owner")) {
                                                    resolve(res["owner"]["userId"]);
                                                } else {
                                                    reject("Invalid Group");
                                                }
                                            }).catch(reject);
                                        } else {
                                            reject("Unknown CreatorType");
                                        }
                                    } else {
                                        reject("Invalid Place");
                                    }
                                }).catch(async () => {
                                    await wait(Math.floor((Math.random() * 2000) + 1000));
                                    await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
                                        if (Object.hasOwnProperty.bind(res)("Creator")) {
                                            if (res["Creator"]["CreatorType"] == "User") {
                                                resolve(res["Creator"]["CreatorTargetId"]);
                                            } else if (res["Creator"]["CreatorType"] == "Group") {
                                                await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                                                    if (Object.hasOwnProperty.bind(res)("owner")) {
                                                        resolve(res["owner"]["userId"]);
                                                    } else {
                                                        reject("Invalid Group");
                                                    }
                                                }).catch(reject);
                                            } else {
                                                reject("Unknown CreatorType");
                                            }
                                        } else {
                                            reject("Invalid Place");
                                        }
                                    }).catch(async () => {
                                        await wait(Math.floor((Math.random() * 2000) + 1000));
                                        await fetch(`https://api.roblox.com/Marketplace/ProductInfo?assetId=${placeId}`).then(r => r.json()).then(async (res) => {
                                            if (Object.hasOwnProperty.bind(res)("Creator")) {
                                                if (res["Creator"]["CreatorType"] == "User") {
                                                    resolve(res["Creator"]["CreatorTargetId"]);
                                                } else if (res["Creator"]["CreatorType"] == "Group") {
                                                    await fetch(`https://groups.roblox.com/v1/groups/${res["Creator"]["CreatorTargetId"]}`).then(r => r.json()).then((res) => {
                                                        if (Object.hasOwnProperty.bind(res)("owner")) {
                                                            resolve(res["owner"]["userId"]);
                                                        } else {
                                                            reject("Invalid Group");
                                                        }
                                                    }).catch(reject);
                                                } else {
                                                    reject("Unknown CreatorType");
                                                }
                                            } else {
                                                reject("Invalid Place");
                                            }
                                        }).catch(reject);
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});