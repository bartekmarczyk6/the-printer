// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFlashloan {
    struct Path {
        address[] tokens;
        uint16[] feeTiers;
        address[] routers;
    }

    struct FlashParams {
        address flashLoanPool;
        uint256 loanAmount;
        Path path;
    }

    struct FlashCallbackData {
        address me;
        address flashLoanPool;
        uint256 loanAmount;
        Path path;
    }
}
