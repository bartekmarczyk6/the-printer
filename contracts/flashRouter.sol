// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/swap-router-contracts/contracts/interfaces/IV3SwapRouter.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import "./base/DodoBase.sol";
import "./base/Withdraw.sol";

import "./interfaces/IDODO.sol";
import "./interfaces/IFlashloan.sol";
import "hardhat/console.sol";


contract FlashRouter is IFlashloan, DodoBase, Withdraw {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event SwapFinished(address token, uint256 amount); // Event emitted when a swap is finished
    event payBackLoan(address token, uint256 amount); // Event emitted when the loan is paid back
    event sentProfit(address recipient, uint256 profit); // Event emitted when profit is sent to recipient

    // IV3SwapRouter public immutable swapRouter;
    // IUniswapV2Router02 public immutable uniswapV2Router;

    // constructor(IV3SwapRouter _swapRouter, IUniswapV2Router02 _uniswapV2Router) {
    //     swapRouter = _swapRouter;
    //     uniswapV2Router = _uniswapV2Router;
    // }

    /**
     * @notice Executes a flash loan on DODO and initiates a swap
     * @param params Flash loan parameters including pool, amount and swap path
     */
    function dodoFlashLoan(FlashParams memory params) external checkParams(params) {
        // Encode the callback data
        bytes memory data = abi.encode(
            FlashCallbackData({
                me: msg.sender,
                flashLoanPool: params.flashLoanPool,
                loanAmount: params.loanAmount,
                path: params.path
            })
        );

        address loanToken = params.path.tokens[0];
        address flashLoanBase = IDODO(params.flashLoanPool)._BASE_TOKEN_();
        // Determine if the loan token is the base or quote token and call the flashloan function
        flashLoanBase == loanToken ?
            IDODO(params.flashLoanPool).flashLoan(params.loanAmount, 0, address(this), data):
            IDODO(params.flashLoanPool).flashLoan(0, params.loanAmount, address(this), data);
    }

    /**
     * @notice Callback function after the flash loan is executed
     * @param sender Address of the caller
     * @param baseAmount Amount of base token
     * @param quoteAmount Amount of quote token
     * @param data Encoded callback data
     */
    function _flashLoanCallBack(
        address,
        uint256,
        uint256,
        bytes calldata data
    ) internal override {
        // Decode the callback data
        FlashCallbackData memory decoded = abi.decode(data, (FlashCallbackData));
        address loanToken = decoded.path.tokens[0];
        uint256 amountIn = decoded.loanAmount;

        // Check if the contract has received the loan amount
        require(
            IERC20(loanToken).balanceOf(address(this)) >= decoded.loanAmount,
            "Failed to borrow loan token"
        );

        uint256 tokensLength = decoded.path.feeTiers.length; // Number of swaps to perform

        console.log(IERC20(loanToken).balanceOf(address(this)));

        // Loop through the swap path and execute swaps
        for (uint256 i = 0; i < tokensLength; i++) {
            uint24 feeTier = decoded.path.feeTiers[i];

            // Execute uniswap v3 swap if fee tier is greater than 0
            if (feeTier > 0) {
                amountIn = uniswapV3(
                    decoded.path.tokens[i], 
                    decoded.path.tokens[i + 1], 
                    feeTier, 
                    amountIn,
                    decoded.path.routers[i]
                );
            } else {
                // Execute uniswap v2 swap if fee tier is 0
                amountIn = uniswapV2(
                    decoded.path.tokens[i],
                    decoded.path.tokens[i + 1],
                    amountIn,
                    decoded.path.routers[i]
                );
            }
        }

        // Emit event after swaps are finished
        emit SwapFinished(
            loanToken,
            IERC20(loanToken).balanceOf(address(this))
        );

        // Check if the contract has enough balance to pay back the loan
        require(
            IERC20(loanToken).balanceOf(address(this)) >= decoded.loanAmount,
            "Not enough amount to return loan"
        );

        // Return the loan amount to the flash loan pool
        IERC20(loanToken).transfer(decoded.flashLoanPool, decoded.loanAmount);
        emit payBackLoan(loanToken, decoded.loanAmount);
    }

    /**
     * @notice Executes a swap on Uniswap V3
     * @param _tokenIn Address of the input token
     * @param _tokenOut Address of the output token
     * @param _feeTier Fee tier of the pool
     * @param _amountIn Amount of input token
     * @param router Address of the Uniswap V3 router
     * @return amountOut Amount of output token
     */
    function uniswapV3(
        address _tokenIn,
        address _tokenOut,
        uint24 _feeTier,
        uint256 _amountIn,
        address router
    ) internal returns (uint256 amountOut) {
        // Approve the router to spend the input token
        IERC20(_tokenIn).approve(router, _amountIn);
        // TransferHelper.safeApprove(_tokenIn, address(router), _amountIn);

        // Execute the swap
        amountOut = IV3SwapRouter(router).exactInputSingle(
            IV3SwapRouter.ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: _feeTier,
                recipient: address(this),
                amountIn: _amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
    }

    /**
     * @notice Executes a swap on Uniswap V2
     * @param _tokenIn Address of the input token
     * @param _tokenOut Address of the output token
     * @param _amountIn Amount of input token
     * @param router Address of the Uniswap V2 router
     * @return amountOut Amount of output token
     */
    function uniswapV2(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        address router
    ) internal returns (uint256 amountOut) {
        // Create the swap path
        address[] memory _path = new address[](2);
            _path[0] = _tokenIn;
            _path[1] = _tokenOut;

        // Approve the router to spend the input token
        IERC20(_tokenIn).approve(router, _amountIn);
        // TransferHelper.safeApprove(_tokenIn, router, _amountIn);

        // Execute the swap
        amountOut = IUniswapV2Router02(router).swapExactTokensForTokens(
            _amountIn,
            1,
            _path,
            address(this),
            block.timestamp + 15
        )[1];
    }

    /**
     * @notice Returns the balance of a given token in this contract
     * @param loanToken Address of the token
     * @return Balance of the token
     */
    function getBalance(address loanToken) public view returns (uint256) {
        return IERC20(loanToken).balanceOf(address(this));
    }
}
